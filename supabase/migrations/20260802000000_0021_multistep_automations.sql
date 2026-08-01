-- ========== AUTOMATISATIONS MULTI-ÉTAPES (séquences avec délais) ==========
-- Jusqu'ici : 1 déclencheur -> 1 action, exécutée immédiatement. Ceci ajoute un vrai moteur de
-- séquence : une automatisation peut avoir plusieurs étapes ordonnées, chacune avec un délai
-- (ex: email immédiat -> attendre 2 jours -> créer une tâche -> attendre 3 jours -> notifier
-- l'équipe). Rétrocompatible : une automatisation SANS étape continue à fonctionner exactement
-- comme avant (action unique immédiate via automations.action).

CREATE TABLE IF NOT EXISTS public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  delay_minutes int NOT NULL DEFAULT 0, -- délai après l'étape précédente (0 = immédiat)
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, position)
);

-- File d'attente des étapes différées : une ligne par étape en attente de son heure d'exécution.
CREATE TABLE IF NOT EXISTS public.automation_run_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.automation_steps(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_run_queue_due ON public.automation_run_queue(status, run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON public.automation_steps(automation_id, position);

ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_steps_select" ON public.automation_steps;
CREATE POLICY "automation_steps_select" ON public.automation_steps
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "automation_steps_insert" ON public.automation_steps;
CREATE POLICY "automation_steps_insert" ON public.automation_steps
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "automation_steps_update" ON public.automation_steps;
CREATE POLICY "automation_steps_update" ON public.automation_steps
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin())
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "automation_steps_delete" ON public.automation_steps;
CREATE POLICY "automation_steps_delete" ON public.automation_steps
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());

-- La file d'attente n'est écrite/lue que par les Edge Functions (service role, bypass RLS) —
-- aucune policy authenticated nécessaire, mais RLS reste activée par défense en profondeur.
ALTER TABLE public.automation_run_queue ENABLE ROW LEVEL SECURITY;
