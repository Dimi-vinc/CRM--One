-- ========== ASSISTANT IA : gratuit pour tous les plans, isolation stricte par tenant ==========
-- Nouveau module "Assistant IA" utilisable par tous les utilisateurs authentifiés d'un tenant,
-- sur tous les plans (Starter inclus) : ce n'est pas une fonctionnalité premium, juste un outil
-- gratuit basé sur l'API gratuite Groq (déjà utilisée par le chatbot support public). Comme pour
-- toutes les tables métier, l'isolation est appliquée au niveau RLS, pas seulement côté frontend.
--
-- Un plafond quotidien par tenant (ai_usage_daily) protège la clé Groq partagée d'un abus par un
-- seul tenant, ce qui garantit que la fonctionnalité reste réellement gratuite et disponible pour
-- tout le monde sur la durée.

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per tenant per day; only ever written by the edge function via the service role
-- (never directly by an authenticated client), so there is no INSERT/UPDATE policy for
-- `authenticated` below — the table is server-controlled by design.
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant_user ON public.ai_conversations(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_tenant_user ON public.ai_messages(tenant_id, user_id);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

-- Conversations: strictly personal (each staff member sees only their own AI chats) and
-- strictly scoped to their own tenant. Requires the tenant to have active access (trial or
-- paid) — same billing gate as the rest of the app — but NOT gated by plan tier: it is included
-- for every plan in src/lib/constants.ts, so it never requires an upgrade.
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations
  FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND user_id = auth.uid() AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() AND user_id = auth.uid() AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update" ON public.ai_conversations
  FOR UPDATE TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND user_id = auth.uid()) OR public.is_super_admin())
  WITH CHECK ((tenant_id = public.current_tenant_id() AND user_id = auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations
  FOR DELETE TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND user_id = auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages
  FOR SELECT TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND user_id = auth.uid()) OR public.is_super_admin());

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert" ON public.ai_messages
  FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() AND user_id = auth.uid() AND public.tenant_has_active_access(tenant_id)) OR public.is_super_admin());

DROP POLICY IF EXISTS "ai_messages_delete" ON public.ai_messages;
CREATE POLICY "ai_messages_delete" ON public.ai_messages
  FOR DELETE TO authenticated
  USING ((tenant_id = public.current_tenant_id() AND user_id = auth.uid()) OR public.is_super_admin());

-- Usage counters: tenants (and super admins) can read their own quota status, but only the
-- service role (edge function, bypasses RLS) may write — no authenticated INSERT/UPDATE policy
-- is defined, so a client can never inflate or reset their own quota.
DROP POLICY IF EXISTS "ai_usage_daily_select" ON public.ai_usage_daily;
CREATE POLICY "ai_usage_daily_select" ON public.ai_usage_daily
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- Atomic increment used by the ai-assistant edge function (called with the service role, which
-- bypasses RLS) so two concurrent requests from the same tenant can't race past the daily cap.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_tenant_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.ai_usage_daily (tenant_id, usage_date, message_count)
  VALUES (p_tenant_id, CURRENT_DATE, 1)
  ON CONFLICT (tenant_id, usage_date)
  DO UPDATE SET message_count = public.ai_usage_daily.message_count + 1
  RETURNING message_count;
$$;
