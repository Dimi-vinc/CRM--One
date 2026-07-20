/*
# Fix: granular super-admin policies (remove FOR ALL catch-alls that block inserts/updates)

## Root cause
The super-admin policies were written as FOR ALL with
  USING (is_super_admin()) WITH CHECK (is_super_admin()).
For INSERT/UPDATE, Postgres AND-combines the WITH CHECK of EVERY applicable policy.
So a regular user inserting a tenant had to satisfy BOTH:
  - tenants_insert_self      WITH CHECK (current_tenant_id() IS NULL)  -> true
  - tenants_super_admin_all  WITH CHECK (is_super_admin())            -> false  -> DENY
Same for profiles UPDATE (onboarding step 2) and subscriptions INSERT (step 3).

## Fix
Replace each `*_super_admin_all` FOR ALL policy with verb-specific super-admin policies
that do NOT carry a WITH CHECK on INSERT/UPDATE for regular users:
  - SELECT ... USING (is_super_admin())            (read access)
  - UPDATE ... USING (is_super_admin()) WITH CHECK (is_super_admin())
  - DELETE ... USING (is_super_admin())
  - INSERT ... WITH CHECK (is_super_admin())       (only super_admins pass this)

Because a regular user's INSERT must still pass tenants_insert_self (current_tenant_id() IS NULL)
and the super-admin INSERT policy only adds a constraint that super_admins satisfy, there is no
contradiction: an INSERT is allowed if ANY matching INSERT policy passes (INSERT policies OR),
while the granular UPDATE/DELETE super-admin policies no longer impose a WITH CHECK on inserts.

## Tables affected
  tenants, profiles, subscriptions
(roles already uses a tenant-scoped FOR ALL which is fine because non-admins in a tenant
 are allowed to manage roles per current_tenant_id(); sales_tracking has its own policies.)

## Security preserved
- Super admin retains full read/update/delete across all tenants.
- Super admin can INSERT (e.g. seed a tenant) via the explicit super_admin INSERT policy.
- Regular users: tenant insert only during onboarding; profile update only own row;
  subscription insert only into their own tenant.
*/

-- ========== TENANTS ==========
DROP POLICY IF EXISTS "tenants_super_admin_all" ON public.tenants;
DROP POLICY IF EXISTS "tenants_super_admin_select" ON public.tenants;
DROP POLICY IF EXISTS "tenants_super_admin_update" ON public.tenants;
DROP POLICY IF EXISTS "tenants_super_admin_delete" ON public.tenants;
DROP POLICY IF EXISTS "tenants_super_admin_insert" ON public.tenants;

CREATE POLICY "tenants_super_admin_select" ON public.tenants
  FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "tenants_super_admin_update" ON public.tenants
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "tenants_super_admin_delete" ON public.tenants
  FOR DELETE TO authenticated USING (is_super_admin());
CREATE POLICY "tenants_super_admin_insert" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

-- ========== PROFILES ==========
DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_delete" ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_insert" ON public.profiles;

CREATE POLICY "profiles_super_admin_select" ON public.profiles
  FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "profiles_super_admin_update" ON public.profiles
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "profiles_super_admin_delete" ON public.profiles
  FOR DELETE TO authenticated USING (is_super_admin());
CREATE POLICY "profiles_super_admin_insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

-- ========== SUBSCRIPTIONS ==========
DROP POLICY IF EXISTS "subscriptions_super_admin_all" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_super_admin_select" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_super_admin_update" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_super_admin_delete" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_super_admin_insert" ON public.subscriptions;

CREATE POLICY "subscriptions_super_admin_select" ON public.subscriptions
  FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "subscriptions_super_admin_update" ON public.subscriptions
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "subscriptions_super_admin_delete" ON public.subscriptions
  FOR DELETE TO authenticated USING (is_super_admin());
CREATE POLICY "subscriptions_super_admin_insert" ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());
