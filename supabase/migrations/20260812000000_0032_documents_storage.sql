-- ========== CORRECTIF FONCTIONNEL MAJEUR : le module Documents n'uploadait jamais rien ==========
-- Documents.tsx enregistrait une ligne en base (nom, type, taille) avec `url: ''` codé en dur,
-- mais n'appelait jamais supabase.storage pour stocker le fichier lui-même — le contenu du
-- fichier était silencieusement perdu à chaque "upload". Il n'y avait même pas de bucket de
-- stockage prévu pour ça. Cette migration crée le bucket manquant avec un chemin structuré
-- `{tenant_id}/{uuid}-{nom}`, ce qui permet une policy RLS de stockage strictement scopée au
-- tenant — cohérente avec le modèle d'accès déjà en place sur la table `documents` (tout membre
-- du tenant peut voir/gérer les documents de son tenant, personne d'un autre tenant).
--
-- Bucket PRIVÉ (pas public comme les avatars) : ce sont des documents d'entreprise (contrats,
-- factures...), pas des images de profil — l'accès en lecture doit passer par une URL signée
-- générée à la demande, jamais par une URL publique devinable.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documents_tenant_read" ON storage.objects;
CREATE POLICY "documents_tenant_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND ((storage.foldername(name))[1] = public.current_tenant_id()::text OR public.is_super_admin()));

DROP POLICY IF EXISTS "documents_tenant_write" ON storage.objects;
CREATE POLICY "documents_tenant_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);

DROP POLICY IF EXISTS "documents_tenant_delete" ON storage.objects;
CREATE POLICY "documents_tenant_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_tenant_id()::text);
