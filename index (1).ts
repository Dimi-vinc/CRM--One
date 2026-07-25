-- ========== AUTOMATIONS ENGINE ==========
-- Adds what was missing for the Automations module to actually execute (previously it only
-- stored rules with no execution engine behind them):
--   1. automations.description column (the UI already reads/writes it, the column didn't exist)
--   2. automation_runs: an execution log so users can see proof that automations actually ran
--   3. automation_config: single-row config holding the deployed edge function URL + a secret
--      used both to authenticate the pg_net call (as the Authorization bearer) and for the edge
--      function to authenticate back to Supabase with elevated (service role) access.
--   4. pg_net-based dispatch: DB triggers on contacts/deals/activities call
--      public.dispatch_automation_event(), which fires an async HTTP call to the
--      "automations-dispatch" edge function. Time-based triggers (task_overdue) are handled by
--      a separate scheduled edge function ("automations-cron"), since they aren't tied to a
--      single row event — see supabase/functions/automations-cron/README.md for scheduling.
--
-- SETUP REQUIRED AFTER DEPLOYING (this migration alone does nothing until configured):
--   1. Deploy the two edge functions (automations-dispatch, automations-cron).
--   2. Set their secrets: RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY (auto-provided), and a
--      random AUTOMATION_DISPATCH_SECRET of your choice.
--   3. Run:
--        insert into public.automation_config (id, edge_function_url, dispatch_secret)
--        values (true, 'https://<PROJECT_REF>.supabase.co/functions/v1/automations-dispatch', '<AUTOMATION_DISPATCH_SECRET>')
--        on conflict (id) do update set edge_function_url = excluded.edge_function_url, dispatch_secret = excluded.dispatch_secret;
--   4. Schedule automations-cron every 15 min via Supabase Dashboard → Edge Functions → Schedule.

ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS overdue_notified boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  trigger text NOT NULL,
  action text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_runs_select" ON public.automation_runs;
CREATE POLICY "automation_runs_select" ON public.automation_runs
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
-- No insert/update/delete policy for authenticated users: only the edge function (using the
-- service role key, which bypasses RLS) writes to this table. This keeps the log tamper-proof
-- from the tenant's own users.

CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant ON public.automation_runs(tenant_id, created_at DESC);

-- Single-row config table. RLS is enabled with NO policies granted to any client role, so it is
-- unreadable from the anon/authenticated API; only SECURITY DEFINER functions owned by the
-- migration role (which bypasses RLS) can read it.
CREATE TABLE IF NOT EXISTS public.automation_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  edge_function_url text,
  dispatch_secret text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_config FROM anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Fire-and-forget dispatch: does nothing (silently) until automation_config is populated,
-- so this migration is safe to run before the edge function is deployed.
CREATE OR REPLACE FUNCTION public.dispatch_automation_event(p_tenant_id uuid, p_trigger text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg record;
BEGIN
  SELECT edge_function_url, dispatch_secret INTO cfg FROM public.automation_config WHERE id = true;
  IF cfg.edge_function_url IS NULL OR cfg.dispatch_secret IS NULL THEN
    RETURN; -- not configured yet
  END IF;

  PERFORM net.http_post(
    url := cfg.edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cfg.dispatch_secret
    ),
    body := jsonb_build_object('tenant_id', p_tenant_id, 'trigger', p_trigger, 'payload', p_payload)
  );
EXCEPTION WHEN OTHERS THEN
  -- Never let a dispatch failure block the underlying CRM write (insert/update on deals, etc.)
  NULL;
END;
$$;

-- ---- Table triggers for row-based events ----

CREATE OR REPLACE FUNCTION public.trg_contacts_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_automation_event(NEW.tenant_id, 'contact_added', row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS contacts_automation_insert ON public.contacts;
CREATE TRIGGER contacts_automation_insert
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_contacts_automation();

CREATE OR REPLACE FUNCTION public.trg_deals_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.dispatch_automation_event(NEW.tenant_id, 'deal_created', row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' AND NEW.stage = 'won' AND (OLD.stage IS DISTINCT FROM 'won') THEN
    PERFORM public.dispatch_automation_event(NEW.tenant_id, 'deal_won', row_to_json(NEW)::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS deals_automation_insert ON public.deals;
CREATE TRIGGER deals_automation_insert
  AFTER INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_deals_automation();
DROP TRIGGER IF EXISTS deals_automation_update ON public.deals;
CREATE TRIGGER deals_automation_update
  AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_deals_automation();

CREATE OR REPLACE FUNCTION public.trg_activities_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed = true AND (OLD.completed IS DISTINCT FROM true) THEN
    PERFORM public.dispatch_automation_event(NEW.tenant_id, 'activity_done', row_to_json(NEW)::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS activities_automation_update ON public.activities;
CREATE TRIGGER activities_automation_update
  AFTER UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.trg_activities_automation();
