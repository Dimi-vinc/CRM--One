-- ========== FORMULAIRES WEB (génération de leads) ==========
-- Un formulaire public, intégrable sur n'importe quel site (iframe ou lien direct), qui crée un
-- vrai Contact à la soumission — ce qui déclenche naturellement les automatisations existantes
-- (le trigger 'contact_added' se déclenche sur TOUT insert dans contacts, peu importe l'origine).

CREATE TABLE IF NOT EXISTS public.web_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]', -- [{key, label, type, required}]
  success_message text NOT NULL DEFAULT 'Merci, nous vous recontacterons rapidement.',
  redirect_url text,
  is_active boolean NOT NULL DEFAULT true,
  submission_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.web_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.web_forms(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_forms_tenant ON public.web_forms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_web_form_submissions_form ON public.web_form_submissions(form_id, created_at DESC);

ALTER TABLE public.web_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "web_forms_tenant_all" ON public.web_forms;
CREATE POLICY "web_forms_tenant_all" ON public.web_forms
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- Un visiteur anonyme doit pouvoir lire la DÉFINITION d'un formulaire actif pour l'afficher
-- (mais jamais les soumissions des autres — celles-ci restent réservées au tenant).
DROP POLICY IF EXISTS "web_forms_public_read_active" ON public.web_forms;
CREATE POLICY "web_forms_public_read_active" ON public.web_forms
  FOR SELECT TO anon
  USING (is_active = true);

ALTER TABLE public.web_form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "web_form_submissions_tenant_select" ON public.web_form_submissions;
CREATE POLICY "web_form_submissions_tenant_select" ON public.web_form_submissions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
-- Pas de policy INSERT pour anon : la soumission passe par l'Edge Function submit-web-form
-- (service role), qui valide et scope correctement chaque insertion.
