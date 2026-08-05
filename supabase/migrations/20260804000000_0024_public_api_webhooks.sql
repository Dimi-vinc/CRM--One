-- ========== API PUBLIQUE + WEBHOOKS SORTANTS (compatible Zapier/Make/n8n) ==========

-- Clés API : jamais stockées en clair, seulement leur hash SHA-256. Le préfixe (8 premiers
-- caractères) est conservé pour permettre à l'utilisateur d'identifier une clé dans l'UI sans
-- jamais pouvoir la revoir en entier après création (comme Stripe/GitHub).
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys_tenant_all" ON public.api_keys;
CREATE POLICY "api_keys_tenant_all" ON public.api_keys
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- Webhooks sortants : le tenant enregistre une URL (ex: une URL "Webhooks by Zapier" / "Catch
-- Hook" de Make/n8n) et les événements à écouter. Fonctionne avec N'IMPORTE QUEL outil
-- consommant des webhooks HTTP standards signés — pas seulement Zapier.
CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhooks_tenant_all" ON public.webhooks;
CREATE POLICY "webhooks_tenant_all" ON public.webhooks
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  status_code int,
  success boolean NOT NULL DEFAULT false,
  response_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id, created_at DESC);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_deliveries_select" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries_select" ON public.webhook_deliveries
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- Rate limiting pour l'API publique : compteur par clé API, fenêtre glissante d'1 minute.
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  api_key_id uuid PRIMARY KEY REFERENCES public.api_keys(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count int NOT NULL DEFAULT 0
);
-- Pas de RLS nécessaire : accédée uniquement par l'Edge Function api-v1 via service role.
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Étend le pont événements -> webhook (même mécanisme que dispatch_automation_event, vers une
-- fonction Edge dédiée à la livraison des webhooks sortants).
ALTER TABLE public.automation_config ADD COLUMN IF NOT EXISTS webhook_dispatch_url text;

CREATE OR REPLACE FUNCTION public.dispatch_webhook_event(p_tenant_id uuid, p_event text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg record;
BEGIN
  SELECT webhook_dispatch_url, dispatch_secret INTO cfg FROM public.automation_config WHERE id = true;
  IF cfg.webhook_dispatch_url IS NULL OR cfg.dispatch_secret IS NULL THEN
    RETURN; -- pas encore configuré
  END IF;
  PERFORM net.http_post(
    url := cfg.webhook_dispatch_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || cfg.dispatch_secret),
    body := jsonb_build_object('tenant_id', p_tenant_id, 'event', p_event, 'payload', p_payload)
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- ne bloque jamais l'écriture CRM sous-jacente
END;
$$;

-- Les triggers existants (contacts/deals/activities) appellent maintenant AUSSI la livraison de
-- webhooks, en plus du moteur d'automatisations — même événement, deux systèmes indépendants.
CREATE OR REPLACE FUNCTION public.trg_contacts_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_automation_event(NEW.tenant_id, 'contact_added', row_to_json(NEW)::jsonb);
  PERFORM public.dispatch_webhook_event(NEW.tenant_id, 'contact_added', row_to_json(NEW)::jsonb);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_deals_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.dispatch_automation_event(NEW.tenant_id, 'deal_created', row_to_json(NEW)::jsonb);
    PERFORM public.dispatch_webhook_event(NEW.tenant_id, 'deal_created', row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' AND NEW.stage = 'won' AND (OLD.stage IS DISTINCT FROM 'won') THEN
    PERFORM public.dispatch_automation_event(NEW.tenant_id, 'deal_won', row_to_json(NEW)::jsonb);
    PERFORM public.dispatch_webhook_event(NEW.tenant_id, 'deal_won', row_to_json(NEW)::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_activities_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed = true AND (OLD.completed IS DISTINCT FROM true) THEN
    PERFORM public.dispatch_automation_event(NEW.tenant_id, 'activity_done', row_to_json(NEW)::jsonb);
    PERFORM public.dispatch_webhook_event(NEW.tenant_id, 'activity_done', row_to_json(NEW)::jsonb);
  END IF;
  RETURN NEW;
END;
$$;
