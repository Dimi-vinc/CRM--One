/*
# Super Admin email whitelist + auto-assignment trigger
# Ensures only the 3 authorized emails get super_admin role, automatically on signup.
*/

-- 1. Whitelist table
CREATE TABLE IF NOT EXISTS public.super_admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.super_admin_emails (email) VALUES
  ('vincentnogue2@gmail.com'),
  ('vincentnogue@yahoo.com'),
  ('webdxb1@gmail.com')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.super_admin_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_super_admin_emails" ON public.super_admin_emails FOR SELECT
  TO authenticated USING (true);

-- 2. Function to auto-assign super_admin role on profile creation
CREATE OR REPLACE FUNCTION public.auto_assign_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.super_admin_emails WHERE email = NEW.email) THEN
    NEW.role := 'super_admin';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger on profiles
DROP TRIGGER IF EXISTS trigger_auto_super_admin ON public.profiles;
CREATE TRIGGER trigger_auto_super_admin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_super_admin();

-- 4. Also update existing profiles if they match the whitelist
UPDATE public.profiles
SET role = 'super_admin'
WHERE email IN (SELECT email FROM public.super_admin_emails)
  AND role <> 'super_admin';
