/*
# Fix: allow an authenticated user without a tenant to INSERT their first tenant

## Problem
During onboarding, a newly-signed-up user (role='custom', tenant_id=NULL) tries to
INSERT a row into `tenants`. The existing policies were:
  - tenants_select_own_or_super  (SELECT)
  - tenants_update_own           (UPDATE)
  - tenants_super_admin_all      (FOR ALL, only is_super_admin())
There was NO INSERT policy for a regular user, so every onboarding failed with
"new row violates row-level security policy for table tenants".

## Fix
Add `tenants_insert_self`:
  - INSERT only, TO authenticated.
  - WITH CHECK that the acting user does NOT already have a tenant_id on their profile.
    This restricts tenant creation to the onboarding moment (first tenant only) and
    prevents a user from spamming extra tenants once they already belong to one.

## Security
- A user can only create a tenant while they have no tenant yet.
- After onboarding sets profile.tenant_id, the check fails, so no further inserts.
- SELECT remains scoped to own tenant (or super_admin), so extra tenants a malicious
  user might have created before being linked are invisible to them.
- No recursion: the WITH CHECK subquery reads profiles (allowed by profiles SELECT
  policy id = auth.uid()), and current_tenant_id() is SECURITY DEFINER (bypasses RLS).
*/

DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
CREATE POLICY "tenants_insert_self" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND tenant_id IS NOT NULL
    )
  );
