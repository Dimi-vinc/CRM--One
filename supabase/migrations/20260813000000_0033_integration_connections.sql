-- ========== MARKETPLACE D'INTÉGRATIONS ==========
-- Table générique unique pour TOUTES les intégrations (IA, paiements, email, etc.) plutôt qu'une
-- table par fournisseur — chaque tenant/utilisateur connecte ses propres identifiants.
-- Isolation stricte : une connexion appartient à un (tenant_id, user_id, provider_id) précis.

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text NOT NULL, -- matches an id in src/lib/integrations.ts's catalog
  auth_type text NOT NULL CHECK (auth_type IN ('api_key', 'oauth')),
  -- API-key auth: the key itself. Stored the same way email_connections already stores OAuth
  -- refresh tokens in this codebase (plaintext column behind RLS, not a vault) — consistent with
  -- the existing established pattern rather than introducing a second one.
  api_key text,
  -- OAuth auth: tokens obtained via the generic oauth-integration-callback function.
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  account_label text, -- e.g. connected email address / workspace name, for display only
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'disconnected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_tenant_user ON public.integration_connections(tenant_id, user_id);

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- Strictly personal, like email_connections: each user manages their own connections. A tenant
-- admin cannot read another teammate's stored API key through this table.
DROP POLICY IF EXISTS "integration_connections_select" ON public.integration_connections;
CREATE POLICY "integration_connections_select" ON public.integration_connections
  FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND user_id = auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "integration_connections_insert" ON public.integration_connections;
CREATE POLICY "integration_connections_insert" ON public.integration_connections
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "integration_connections_update" ON public.integration_connections;
CREATE POLICY "integration_connections_update" ON public.integration_connections
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid())
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "integration_connections_delete" ON public.integration_connections;
CREATE POLICY "integration_connections_delete" ON public.integration_connections
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND user_id = auth.uid());
