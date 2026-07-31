-- ============================================================
-- CRM-One — Migrations consolidées 0011 à 0017
-- À exécuter EN UNE SEULE FOIS dans le SQL Editor Supabase
-- Toutes les policies sont idempotentes : sûr de ré-exécuter
-- ce script entier même si une partie a déjà été appliquée.
-- ============================================================


-- ============================================================
-- 20260725120000_0011_automations_engine.sql
-- ============================================================
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


-- ============================================================
-- 20260726070000_0012_pro_modules.sql
-- ============================================================
-- ========== TICKETS (Support client) ==========
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sla_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== DEVIS & FACTURES (client-facing, distinct from the tenant's own SaaS subscription) ==========
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_number text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  currency_code text NOT NULL DEFAULT 'USD',
  valid_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  currency_code text NOT NULL DEFAULT 'USD',
  issued_date date NOT NULL DEFAULT current_date,
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0
);

-- ========== CAMPAGNES EMAIL (réutilise Resend, déjà branché pour les automatisations) ==========
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent')),
  segment_country_code text, -- null = all contacts
  segment_min_score int,     -- null = no score filter (uses the existing lead scoring)
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped_no_consent')),
  error text,
  sent_at timestamptz
);

-- ========== RGPD: consentement marketing sur les contacts ==========
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS consent_updated_at timestamptz;

-- ========== BASE DE CONNAISSANCES ==========
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  content text NOT NULL,
  category text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

-- ========== TERRITOIRES & QUOTAS DE VENTE ==========
CREATE TABLE IF NOT EXISTS public.sales_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  country_codes text[] NOT NULL DEFAULT '{}',
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period text NOT NULL, -- e.g. '2026-Q3' or '2026-07'
  target_amount numeric NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, period)
);

-- ========== RLS: standard tenant-scoped policy for every new table ==========
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tickets', 'ticket_comments', 'quotes', 'quote_items', 'invoices', 'invoice_items',
    'email_campaigns', 'email_campaign_recipients', 'kb_articles', 'sales_territories', 'sales_quotas'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_isolation" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_tenant_isolation" ON public.%I FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id() OR public.is_super_admin()) WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin())',
      t, t
    );
  END LOOP;
END $$;

-- Public read access to published knowledge base articles (anon role, no auth needed)
DROP POLICY IF EXISTS "kb_articles_public_read" ON public.kb_articles;
CREATE POLICY "kb_articles_public_read" ON public.kb_articles
  FOR SELECT TO anon
  USING (is_public = true);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON public.tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON public.quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.email_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_tenant ON public.kb_articles(tenant_id);


-- ============================================================
-- 20260727000000_0013_settings_avatars.sql
-- ============================================================
-- ========== PARAMÈTRES: stockage des avatars ==========
-- Bucket public en lecture (les avatars s'affichent dans toute l'app sans authentification
-- nécessaire côté <img>), mais écriture strictement limitée au propriétaire de son propre
-- fichier (chemin préfixé par son user id).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_write" ON storage.objects;
CREATE POLICY "avatars_owner_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ========== SÉCURITÉ CRITIQUE : anti-escalade de privilèges ==========
-- La policy "profiles_update_self" (existante) autorise un utilisateur à modifier SA PROPRE
-- ligne (id = auth.uid()), mais ne restreint aucune colonne. Sans garde-fou, un utilisateur
-- pourrait techniquement changer son propre "role" en 'admin'/'super_admin' ou son "tenant_id"
-- vers un autre tenant via un simple appel .update() — une brèche d'isolation totale.
-- Ce trigger bloque tout changement de role/tenant_id/status par l'utilisateur lui-même ;
-- seul le service role (utilisé par les Edge Functions, ex: invitations, delete-account) ou un
-- super admin peut légitimement modifier ces colonnes.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() is NULL when called via the service role (Edge Functions) — always allowed.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Super admins may legitimately change roles/tenant assignment (e.g. tenant management tools).
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Modification non autorisée : role, tenant_id et status ne peuvent pas être modifiés par l''utilisateur lui-même.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Tighten tenant settings updates to admins only (previously any tenant member could update
-- their tenant's row — name, currency, timezone — since the policy only checked tenant_id).
DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants;
CREATE POLICY "tenants_update_own" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id() AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (id = public.current_tenant_id());

-- ========== SÉCURITÉ CRITIQUE : anti-contournement de facturation ==========
-- Now that tenant admins can update their own tenant row (for name/currency/timezone in
-- Paramètres), they could otherwise also set plan_id='entreprise' or status='active' on
-- themselves directly — bypassing Stripe entirely. Only the service role (Stripe webhook,
-- Super Admin tools) may change plan_id, status, or trial_ends_at.
CREATE OR REPLACE FUNCTION public.prevent_tenant_billing_bypass()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Modification non autorisée : plan_id, status et trial_ends_at sont gérés uniquement par la facturation.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_billing_bypass ON public.tenants;
CREATE TRIGGER trg_prevent_tenant_billing_bypass
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_billing_bypass();

-- The previous "subscriptions_update_own" / "subscriptions_delete_own" policies let ANY tenant
-- member (not just admins) update or delete their tenant's subscription row directly — including
-- setting status='active' themselves, a full billing bypass. Only Stripe webhooks (service role,
-- which bypasses RLS) and Super Admin should ever write to subscriptions after creation.
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_modify_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_super_admin_only" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_delete_super_admin_only" ON public.subscriptions;
CREATE POLICY "subscriptions_update_super_admin_only" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
CREATE POLICY "subscriptions_delete_super_admin_only" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- ============================================================
-- 20260727010000_0014_scale_indexes.sql
-- ============================================================
-- ========== INDEX DE PERFORMANCE POUR LA MONTÉE EN CHARGE ==========
-- Les index précédents ne portaient que sur tenant_id seul. À l'échelle (des dizaines de
-- milliers de lignes par tenant), toute liste triée par date nécessite un index composite
-- (tenant_id, created_at DESC) pour éviter un tri complet en mémoire à chaque requête.

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON public.contacts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email ON public.contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_created ON public.companies(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_name ON public.companies(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_created ON public.deals(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_owner_stage ON public.deals(tenant_id, owner_id, stage);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_due ON public.activities(tenant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due ON public.tasks(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_created ON public.documents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_created ON public.quotes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON public.invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_created ON public.email_campaigns(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- Full-text-ish search helpers: case-insensitive prefix search on the fields the UI actually
-- filters/searches by (Contacts/Companies search boxes).
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts(tenant_id, lower(first_name), lower(last_name));
CREATE INDEX IF NOT EXISTS idx_companies_name_lower ON public.companies(tenant_id, lower(name));


-- ============================================================
-- 20260729000000_0015_super_admin_team.sql
-- ============================================================
-- ========== ÉQUIPE SUPER ADMIN : permissions sur la liste blanche ==========
-- La table super_admin_emails n'avait qu'une policy SELECT ouverte à TOUS les utilisateurs
-- authentifiés (fuite d'information : n'importe quel tenant pouvait voir qui sont les super
-- admins) et AUCUNE policy INSERT/UPDATE/DELETE (un super admin ne pouvait donc pas ajouter de
-- collègue depuis l'app malgré l'intention du mécanisme).

DROP POLICY IF EXISTS "read_super_admin_emails" ON public.super_admin_emails;
DROP POLICY IF EXISTS "super_admin_emails_select" ON public.super_admin_emails;
CREATE POLICY "super_admin_emails_select" ON public.super_admin_emails
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_emails_insert" ON public.super_admin_emails;
CREATE POLICY "super_admin_emails_insert" ON public.super_admin_emails
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "super_admin_emails_delete" ON public.super_admin_emails;
CREATE POLICY "super_admin_emails_delete" ON public.super_admin_emails
  FOR DELETE TO authenticated
  USING (public.is_super_admin());


-- ============================================================
-- 20260730000000_0016_whatsapp_phone.sql
-- ============================================================
-- ========== WHATSAPP: numéro de téléphone sur le profil ==========
-- Nécessaire pour que les automatisations puissent notifier les admins via WhatsApp (Twilio).
-- Format attendu : E.164 (ex: +237600000000, +33612345678).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;


-- ============================================================
-- 20260731000000_0017_fix_onboarding_escalation_guard.sql
-- ============================================================
-- ========== FIX: le trigger anti-escalade bloquait l'onboarding légitime ==========
-- La migration 0013 a introduit un trigger BEFORE UPDATE sur profiles empêchant un
-- utilisateur de modifier lui-même role/tenant_id/status (anti-escalade de privilèges).
-- Problème : complete_onboarding() (SECURITY DEFINER) doit justement faire
-- `UPDATE profiles SET tenant_id = <nouveau_tenant>, role = 'admin' WHERE id = auth.uid()`
-- pour promouvoir le créateur du compte admin de sa propre entreprise — auth.uid() n'est PAS
-- NULL dans ce contexte (SECURITY DEFINER change les privilèges d'exécution, pas les claims
-- JWT de la requête), donc le trigger bloquait aussi ce cas parfaitement légitime.
--
-- Correction : on autorise UNE seule transition précise, sans rouvrir la faille d'origine :
--   - AVANT : tenant_id IS NULL (l'utilisateur n'appartient encore à aucun tenant)
--   - APRÈS : role devient exactement 'admin' (jamais 'super_admin' — impossible de
--     s'auto-promouvoir super admin par ce chemin)
-- Une fois qu'un profil a un tenant_id, plus aucune auto-modification de
-- role/tenant_id/status n'est permise (le reste du trigger d'origine s'applique toujours).

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- Cas légitime unique : onboarding initial (première assignation à un tenant, en tant
  -- qu'admin de ce tenant). Ne s'applique qu'une fois : dès que tenant_id est déjà renseigné,
  -- cette exception ne s'applique plus.
  IF OLD.tenant_id IS NULL AND NEW.tenant_id IS NOT NULL AND NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Modification non autorisée : role, tenant_id et status ne peuvent pas être modifiés par l''utilisateur lui-même.';
  END IF;
  RETURN NEW;
END;
$$;

