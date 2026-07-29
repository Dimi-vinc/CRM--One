-- ========== WHATSAPP: numéro de téléphone sur le profil ==========
-- Nécessaire pour que les automatisations puissent notifier les admins via WhatsApp (Twilio).
-- Format attendu : E.164 (ex: +237600000000, +33612345678).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
