/*
# Fix (robust): tenants INSERT policy using SECURITY DEFINER helper

## Problem
The previous `tenants_insert_self` policy used a WITH CHECK subquery into `profiles`:
  NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tenant_id IS NOT NULL)
That subquery is itself subject to `profiles` RLS (nested-RLS), making the check fragile.
The onboarding INSERT still failed with "new row violates row-level security policy".

## Fix
Replace the WITH CHECK with a call to the SECURITY DEFINER function `current_tenant_id()`,
which reads profiles directly (bypassing RLS) and returns the caller's tenant_id or NULL.
A user may INSERT a tenant only while they have no tenant yet (onboarding moment).

  WITH CHECK (current_tenant_id() IS NULL)

## Why this is robust
- `current_tenant_id()` is `SECURITY DEFINER` with `SET search_path = public`, so it
  reads profiles with the owner's privileges, not subject to RLS → no nested-RLS interaction,
  no recursion, no dependency on the profiles SELECT policy.
- Returns NULL both when the user has no profile yet and when their profile has tenant_id NULL
  — both are valid onboarding states that should be allowed to create a tenant.
- After onboarding sets profile.tenant_id, current_tenant_id() returns the new id (non-null),
  so the check fails and no further tenant inserts are allowed.

## Security
- Only authenticated users without a tenant can create one.
- SELECT remains scoped to own tenant (or super_admin), so a user can never read tenants
  they don't belong to.
*/

DROP POLICY IF EXISTS "tenants_insert_self" ON public.tenants;
CREATE POLICY "tenants_insert_self" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (current_tenant_id() IS NULL);
