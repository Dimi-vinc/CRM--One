-- ========== CORRECTIF SÉCURITÉ : policy de stockage avatars incomplète ==========
-- "avatars_owner_update" n'avait qu'une clause USING, pas de WITH CHECK. En RLS Postgres,
-- USING contrôle quelle ligne EXISTANTE peut être mise à jour ; WITH CHECK contrôle ce que la
-- ligne devient APRÈS la mise à jour. Sans WITH CHECK, un utilisateur authentifié pouvait
-- modifier la colonne `name` (le chemin du fichier) de son propre objet avatar pour le faire
-- pointer dans le dossier d'un AUTRE utilisateur (le chemin est structuré `avatars/{user_id}/...`)
-- — un déplacement/écrasement de fichier hors de son propre isolement de dossier.
-- On aligne cette policy sur "avatars_owner_write" (INSERT), qui avait déjà la bonne contrainte.

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
