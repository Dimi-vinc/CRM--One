/*
# Definitive fix: SECURITY DEFINER function for tenants INSERT check

## Root cause (final analysis)
Every previous fix used a WITH CHECK expression that ultimately reads the `profiles` table
from within the authenticated role. This triggers the profiles RLS policies, which in turn
call current_tenant_id(), which reads profiles again — a re-entrant query that Postgres
resolves inconsistently, causing the INSERT to fail even with logically correct conditions.

The chain:
  tenants INSERT WITH CHECK
    → NOT EXISTS (SELECT FROM profiles WHERE id = auth.uid() ...)
      → profiles SELECT RLS evaluates: id = auth.uid() OR tenant_id = current_tenant_id() OR ...
        → current_tenant_id() runs: SELECT tenant_id FROM profiles WHERE id = auth.uid()
          → profiles SELECT RLS again... (re-entrant)

current_tenant_id() IS SECURITY DEFINER so it bypasses RLS when it reads profiles,
BUT the outer NOT EXISTS subquery still runs under authenticated RLS on profiles.
This creates a fragile evaluation order that is unreliable.

## Fix
Create a dedicated SECURITY DEFINER function `user_can_insert_tenant()` that:
1. Reads profiles directly with SECURITY DEFINER (bypasses ALL RLS)
2. Returns true if auth.uid() has no tenant yet (or is super_admin)
3. Is the ONLY check in the tenants INSERT policy

This eliminates all RLS re-entrancy: the function owner (postgres) reads profiles
directly, no RLS policies are triggered, auth.uid() is read from the session JWT.

## Why this is secure
- SECURITY DEFINER + SET search_path = public prevents search_path injection
- The function returns true ONLY when the calling user has no tenant_id
- After onboarding sets profile.tenant_id, the check returns false → no double-tenanting
- super_admin bypass is explicit
*/

-- Create the dedicated helper function
CREATE OR REPLACE FUNCTION public.user_can_insert_tenant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (
    -- No profile yet (brand new user, trigger may not have run)
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid())
    OR
    -- Profile exists but has no tenant yet (onboarding state)
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tenant_id IS NULL)
    OR
    -- Super admin
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
$$;

-- Replace the tenants INSERT policy with a single, clean check
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
DROP POLICY IF EXISTS "tenants_super_admin_insert" ON public.tenants;

CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_insert_tenant());
