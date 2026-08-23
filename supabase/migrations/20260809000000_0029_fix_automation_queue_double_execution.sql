-- ========== CORRECTIF BUG : double-exécution possible des étapes d'automatisation ==========
-- automations-cron lisait les lignes 'pending' de automation_run_queue, les traitait, PUIS les
-- marquait 'done'/'failed'. Rien ne "réservait" une ligne avant traitement : si deux invocations
-- de la fonction se chevauchent (répétition suite à un timeout, déclenchement manuel pendant
-- l'exécution planifiée, double appel du scheduler), les deux peuvent lire la même ligne
-- 'pending' avant qu'aucune ne l'ait marquée comme traitée — résultat : la même étape (envoi
-- d'email, création de tâche, notification...) s'exécute deux fois.
--
-- Correctif : une fonction atomique qui RÉSERVE les lignes dues (passage à 'processing' avec
-- verrouillage `FOR UPDATE SKIP LOCKED`) en une seule opération, avant tout traitement. Deux
-- invocations concurrentes se partagent alors les lignes sans jamais se chevaucher. Une ligne
-- restée bloquée en 'processing' plus de 10 minutes (fonction plantée avant d'avoir fini) est
-- automatiquement re-réclamable, pour éviter qu'un crash ne bloque une étape indéfiniment.

ALTER TABLE public.automation_run_queue ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.automation_run_queue DROP CONSTRAINT IF EXISTS automation_run_queue_status_check;
ALTER TABLE public.automation_run_queue ADD CONSTRAINT automation_run_queue_status_check
  CHECK (status IN ('pending', 'processing', 'done', 'failed'));

DROP INDEX IF EXISTS idx_automation_run_queue_due;
CREATE INDEX IF NOT EXISTS idx_automation_run_queue_due ON public.automation_run_queue(status, run_at) WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.claim_due_automation_steps(p_limit integer DEFAULT 200)
RETURNS SETOF public.automation_run_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.automation_run_queue
  SET status = 'processing', claimed_at = now()
  WHERE id IN (
    SELECT id FROM public.automation_run_queue
    WHERE run_at <= now()
      AND (status = 'pending' OR (status = 'processing' AND claimed_at < now() - interval '10 minutes'))
    ORDER BY run_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
