/*
# DIAGNOSTIC: temporarily replace tenants INSERT policy with WITH CHECK (true)
to isolate whether the problem is the policy expression or something else.
Will revert after diagnosis.
*/
DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;
CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT TO authenticated
  WITH CHECK (true);
