-- ========== CORRECTIF SÉCURITÉ : contournement du paiement via integration_connections ==========
-- Toutes les autres tables métier (migration 0025) et l'Assistant IA (migration 0026) vérifient
-- tenant_has_active_access() sur les écritures. integration_connections avait été oubliée : un
-- tenant dont l'essai a expiré pouvait continuer à CRÉER de nouvelles connexions d'intégration
-- (nouvelle clé API OpenAI, nouveau webhook Slack, etc.) directement via l'API REST Supabase avec
-- son propre jeton valide — contournant entièrement le mur de paiement frontend, exactement le
-- scénario que la migration 0025 visait à éliminer partout.
--
-- SELECT/UPDATE/DELETE restent non bloqués par la facturation (comme pour ai_conversations) : un
-- tenant expiré peut toujours voir/gérer ce qu'il avait déjà connecté pendant qu'il était actif,
-- il ne peut simplement pas en créer de nouvelles pendant que l'accès est suspendu.

DROP POLICY IF EXISTS "integration_connections_insert" ON public.integration_connections;
CREATE POLICY "integration_connections_insert" ON public.integration_connections
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND user_id = auth.uid() AND public.tenant_has_active_access(tenant_id));

-- Same gap, same fix, for real file uploads to the documents storage bucket (migration 0032):
-- an expired tenant could still upload files (consuming real storage) even though the follow-up
-- metadata row insert into public.documents was already correctly blocked by the 0025 loop —
-- meaning storage got consumed for nothing, and the bypass existed at the storage layer even
-- though the app-level record never got created.
DROP POLICY IF EXISTS "documents_tenant_write" ON storage.objects;
CREATE POLICY "documents_tenant_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_tenant_id()::text
    AND public.tenant_has_active_access(public.current_tenant_id())
  );
