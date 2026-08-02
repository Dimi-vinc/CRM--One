-- ========== INTÉGRATIONS EMAIL (Gmail / Outlook) ==========
-- Stocke les tokens OAuth par UTILISATEUR (pas par tenant) — chacun connecte son propre compte
-- email personnel, exactement comme dans un vrai CRM (Salesforce/HubSpot font pareil : c'est
-- TON compte Gmail, pas celui de l'entreprise).
--
-- Sécurité critique : les tokens ne sont JAMAIS exposés au frontend. Aucune policy SELECT
-- n'autorise leur lecture directe par le client — ils ne sont lus que par les Edge Functions
-- via le service role (qui bypass RLS). Le frontend ne voit que le statut de connexion
-- (connecté/déconnecté, adresse email) via une fonction dédiée qui ne renvoie jamais les tokens.

CREATE TABLE IF NOT EXISTS public.email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  email_address text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
-- Aucune policy SELECT/INSERT/UPDATE/DELETE pour authenticated : cette table n'est accessible
-- QUE via les Edge Functions (service role). Le frontend appelle des fonctions dédiées
-- (get-email-connection-status, disconnect-email) qui ne renvoient jamais les tokens bruts.

-- Journal des emails envoyés via un compte connecté (pour affichage dans l'historique du contact
-- et pour éviter de dupliquer l'envoi en cas de retry).
CREATE TABLE IF NOT EXISTS public.sent_emails_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  provider text NOT NULL,
  subject text NOT NULL,
  to_email text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sent_emails_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sent_emails_log_select" ON public.sent_emails_log;
CREATE POLICY "sent_emails_log_select" ON public.sent_emails_log
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

CREATE INDEX IF NOT EXISTS idx_sent_emails_log_contact ON public.sent_emails_log(contact_id, created_at DESC);
