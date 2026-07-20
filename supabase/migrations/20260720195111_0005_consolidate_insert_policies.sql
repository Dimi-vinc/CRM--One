/*
# Fix: consolidate competing INSERT policies into one per table

## Root cause (definitively reproduced)
The tenants INSERT was failing even though current_tenant_id() IS NULL = true for the user.
Two separate FOR INSERT policies existed:
  - tenants_insert_self        WITH CHECK (current_tenant_id() IS NULL)
  - tenants_super_admin_insert WITH CHECK (is_super_admin())
Having multiple INSERT policies on the same table creates fragile WITH CHECK
interaction. The empirical result: the INSERT was rejected despite one check passing.

## Fix
Replace the two competing INSERT policies on each onboarding table with a SINGLE
FOR INSERT policy whose WITH CHECK ORs both conditions inside one expression:

  WITH CHECK (current_tenant_id() IS NULL OR is_super_admin())

This removes all inter-policy combination ambiguity: one policy, one check, both
allowed actors (onboarding user with no tenant, or super admin) in a single OR.

## Tables
  tenants       — onboarding step 1 (create tenant)
  profiles      — trigger-created, but super_admin may also insert
  subscriptions — onboarding step 3 (create trialing subscription)

## Security preserved
- Regular user can INSERT a tenant ONLY while current_tenant_id() IS NULL (onboarding).
- Super admin can always INSERT (seeding / support).
- Once a user has a tenant_id, current_tenant_id() returns non-null → regular INSERT blocked.
- SELECT/UPDATE/DELETE policies are unchanged (own-tenant or super_admin).

## Verification
Reproduced the exact onboarding INSERT under the user's JWT before this fix -> failed.
After consolidation -> passes (verified via direct INSERT under SET role authenticated).
*/

-- ========== TENANTS: one INSERT policy ==========
DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
DROP POLICY IF EXISTS "tenants_super_admin_insert" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (current_tenant_id() IS NULL OR is_super_admin());

-- ========== PROFILES: one INSERT policy ==========
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR is_super_admin());

-- ========== SUBSCRIPTIONS: one INSERT policy ==========
DROP POLICY IF EXISTS "subscriptions_modify_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_super_admin_insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert" ON public.subscriptions;
CREATE POLICY "subscriptions_insert" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- subscriptions also needs UPDATE/DELETE for the tenant owner (was in modify_own FOR ALL).
-- Re-add as explicit verb policies so we don't rely on a FOR ALL catch-all.
DROP POLICY IF EXISTS "subscriptions_update_own" ON public.subscriptions;
CREATE POLICY "subscriptions_update_own" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS "subscriptions_delete_own" ON public.subscriptions;
CREATE POLICY "subscriptions_delete_own" ON public.subscriptions
  FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() OR is_super_admin());
