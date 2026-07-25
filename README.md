/*
# Fix (final): secure tenants INSERT using direct auth.uid() subquery

## Why previous fixes failed to resolve
- Migration 0002 used a profiles subquery (correct idea) but was replaced by 0003
  which used current_tenant_id() (SECURITY DEFINER). 
- Migration 0005 consolidated policies but kept current_tenant_id().
- Migration 0006 was a diagnostic with WITH CHECK (true) — INSECURE, must revert.

## Root cause
The current_tenant_id() SECURITY DEFINER function may behave unexpectedly inside
a WITH CHECK expression (auth.uid() can return NULL inside SECURITY DEFINER
contexts in some PostgREST configurations, making the check unreliable).

## Fix
Replace the diagnostic WITH CHECK (true) with a direct, transparent check:

  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND tenant_id IS NOT NULL)
    OR is_super_admin()
  )

Why this works reliably:
- Uses auth.uid() directly (no SECURITY DEFINER function indirection).
- The subquery reads profiles, which is subject to profiles RLS. The profiles SELECT
  policy allows `id = auth.uid()`, so the user CAN see their own row.
- If the user has no tenant (tenant_id IS NULL) or no profile → NOT EXISTS = true → INSERT allowed.
- If the user already has a tenant → NOT EXISTS = false → INSERT blocked (unless super_admin).
- Super admin always passes via the OR.

## Security
- A user can only INSERT a tenant while they have no tenant_id (onboarding moment).
- SELECT remains scoped to own tenant or super_admin, so extra tenants are invisible.
- The diagnostic WITH CHECK (true) is removed (was temporarily insecure).
*/

-- ========== TENANTS: restore secure INSERT ==========
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
DROP POLICY IF EXISTS "tenants_super_admin_insert" ON public.tenants;
CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tenant_id IS NOT NULL
    )
    OR is_super_admin()
  );

-- ========== PROFILES: keep single INSERT (already correct) ==========
-- profiles_insert: id = auth.uid() OR is_super_admin() — already in place, no change needed.

-- ========== SUBSCRIPTIONS: keep single INSERT (already correct) ==========
-- subscriptions_insert: tenant_id = current_tenant_id() OR is_super_admin()
-- This works because by the time subscriptions INSERT runs (onboarding step 3),
-- the profile has already been updated with tenant_id (step 2), so current_tenant_id()
-- returns the new tenant id which matches the subscription's tenant_id.
