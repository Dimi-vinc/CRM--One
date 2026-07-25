/*
# Definitive fix: atomic SECURITY DEFINER onboarding function

## Why
After 4 RLS policy fixes, the tenants INSERT still fails for real users because:
- Any WITH CHECK that reads `profiles` triggers profiles RLS → current_tenant_id()
  → re-reads profiles (re-entrancy) → inconsistent evaluation → INSERT rejected.
- Even a pure SECURITY DEFINER helper (user_can_insert_tenant) called from the
  WITH CHECK still failed empirically, because the WITH CHECK expression itself
  runs under the authenticated role and the function call context is fragile.

## Solution
Stop relying on RLS for onboarding entirely. Create a single SECURITY DEFINER
PL/pgSQL function `complete_onboarding()` that:
1. Runs as the postgres owner → BYPASSES all RLS (SECURITY DEFINER).
2. Does its own authorization check in the function body (the calling user must
   be authenticated and must not already have a tenant_id).
3. Performs ALL onboarding steps atomically in one transaction:
   a. INSERT the tenant
   b. UPDATE the caller's profile (tenant_id, role='admin', full_name)
   c. INSERT the subscription (trialing)
   d. INSERT default custom roles
   e. INSERT sales_tracking if a commercial code is provided
4. Returns the new tenant id on success, or raises an exception on failure.

The frontend calls this via supabase.rpc('complete_onboarding', { ... }) — a single
round-trip, no RLS policies involved on the write path.

## Authorization inside the function
- auth.uid() IS NOT NULL (must be authenticated)
- The caller's profile must have tenant_id IS NULL (onboarding state)
- If a profile row doesn't exist yet, the function creates a minimal one first
  (covers the edge case where the auth.users trigger hasn't run yet)

## Security
- SECURITY DEFINER + SET search_path = public → no search_path injection
- The function only ever sets tenant_id on the CALLER's own profile (auth.uid())
- A user with an existing tenant_id gets a clear error
- Super admin can also onboard (creates a tenant they own)
*/

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_company_name text,
  p_country_code text DEFAULT 'CM',
  p_region text DEFAULT '',
  p_city text DEFAULT '',
  p_currency_code text DEFAULT 'XAF',
  p_timezone text DEFAULT 'Africa/Douala',
  p_locale text DEFAULT 'fr',
  p_phone_country_code text DEFAULT '+237',
  p_plan_id text DEFAULT 'pro',
  p_full_name text DEFAULT NULL,
  p_commercial_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile profiles%ROWTYPE;
  v_tenant_id uuid;
  v_trial_ends timestamptz := now() + interval '7 days';
  v_code_id uuid;
BEGIN
  -- 1. Authorization: must be authenticated
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Session expirée — veuillez vous reconnecter.';
  END IF;

  -- 2. Load the caller's profile (bypasses RLS because SECURITY DEFINER)
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;

  -- 3. If no profile yet, create a minimal one (trigger may not have run)
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, full_name)
    SELECT v_uid, u.email, COALESCE(p_full_name, u.email)
    FROM auth.users u WHERE u.id = v_uid;
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  END IF;

  -- 4. Authorization: must not already have a tenant (prevents double-onboarding)
  IF v_profile.tenant_id IS NOT NULL AND v_profile.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Vous avez déjà une entreprise configurée.';
  END IF;

  -- 5. Create the tenant
  INSERT INTO public.tenants (
    name, country_code, region, city, currency_code, timezone, locale,
    phone_country_code, plan_id, trial_ends_at, status
  ) VALUES (
    COALESCE(NULLIF(TRIM(p_company_name), ''), 'Mon entreprise'),
    COALESCE(NULLIF(TRIM(p_country_code), ''), 'CM'),
    COALESCE(p_region, ''),
    COALESCE(p_city, ''),
    COALESCE(NULLIF(TRIM(p_currency_code), ''), 'XAF'),
    COALESCE(NULLIF(TRIM(p_timezone), ''), 'Africa/Douala'),
    COALESCE(NULLIF(TRIM(p_locale), ''), 'fr'),
    COALESCE(NULLIF(TRIM(p_phone_country_code), ''), '+237'),
    COALESCE(NULLIF(TRIM(p_plan_id), ''), 'pro'),
    v_trial_ends,
    'trial'
  )
  RETURNING id INTO v_tenant_id;

  -- 6. Promote the caller to admin of the new tenant
  UPDATE public.profiles
  SET tenant_id = v_tenant_id,
      role = 'admin',
      full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), v_profile.email)
  WHERE id = v_uid;

  -- 7. Create trialing subscription
  INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_end)
  VALUES (v_tenant_id, COALESCE(NULLIF(TRIM(p_plan_id), ''), 'pro'), 'trialing', v_trial_ends)
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end;

  -- 8. Seed default custom roles
  INSERT INTO public.roles (tenant_id, name, description, permissions) VALUES
    (v_tenant_id, 'Commercial', 'Accès pipeline et deals',
     '{"pipeline":["view","create","edit"],"contacts":["view","create","edit"],"companies":["view","create","edit"]}'::jsonb),
    (v_tenant_id, 'Comptable', 'Accès facturation et rapports financiers',
     '{"billing":["view"],"reports":["view"]}'::jsonb),
    (v_tenant_id, 'Fonctionnel / Support', 'Configuration et support',
     '{"contacts":["view"],"tasks":["view","create","edit"]}'::jsonb);

  -- 9. Commercial code tracking link (optional)
  IF p_commercial_code IS NOT NULL AND TRIM(p_commercial_code) <> '' THEN
    SELECT id INTO v_code_id FROM public.commercial_codes
    WHERE code = TRIM(p_commercial_code) AND is_active = true;
    IF v_code_id IS NOT NULL THEN
      INSERT INTO public.sales_tracking (commercial_code_id, tenant_id, amount, currency)
      VALUES (v_code_id, v_tenant_id, 0, 'USD');
    END IF;
  END IF;

  RETURN v_tenant_id;
END;
$$;

-- Allow any authenticated user to call the function.
-- The authorization logic lives INSIDE the function body.
GRANT EXECUTE ON FUNCTION public.complete_onboarding TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding TO anon;
