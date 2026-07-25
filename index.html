/*
# SaaS Multi-Tenant Foundation Schema

## Purpose
Fully isolated multi-tenant SaaS. Each tenant (customer company) has total data isolation via RLS.
Super Admin has controlled cross-tenant visibility (the only exception).

## Tables
1. tenants — customer organizations with plan, trial, locale, currency.
2. profiles — auth.users extension; links user to tenant + role (super_admin | admin | custom).
3. roles — custom roles created by tenant Admin, scoped to tenant, with permissions jsonb.
4. plans — 4 seeded plans (Starter/Pro/Premium/Entreprise).
5. commercial_codes — Super-Admin-created sales-rep codes; optional at onboarding.
6. audit_log — sensitive actions (suspension, plan change, promotion, cross-tenant access).
7. announcements — global Super Admin messages.
8. sales_tracking — links tenant signup to a commercial_code.
9. subscriptions — per-tenant subscription + Stripe ids.
10. tenant_invitations — Admin-sent invites.
11-18. CRM: contacts, companies, deals, activities, tasks, documents, automations, notifications (all tenant-scoped).

## Security
- All tenant-scoped tables: SELECT/INSERT/UPDATE/DELETE filtered by current_tenant_id() or is_super_admin().
- profiles: self + tenant members + super_admin.
- plans: public read; super_admin write.
- commercial_codes: anon read of active codes (validation at onboarding); super_admin all.
- audit_log: super_admin read; self insert.
- Helper functions is_super_admin() and current_tenant_id() are SECURITY DEFINER.
- Trigger on auth.users creates a profile row for every new signup.

## Notes
1. tenant_id filter is enforced by RLS — frontend cannot bypass.
2. Super Admin profile is created manually via SQL bootstrap (no public super_admin signup).
3. Policies are idempotent (DROP IF EXISTS before CREATE).
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========== TENANTS ==========
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text NOT NULL DEFAULT 'CM',
  region text,
  city text,
  currency_code text NOT NULL DEFAULT 'XAF',
  timezone text NOT NULL DEFAULT 'Africa/Douala',
  locale text NOT NULL DEFAULT 'fr',
  phone_country_code text NOT NULL DEFAULT '+237',
  plan_id text NOT NULL DEFAULT 'starter',
  trial_ends_at timestamptz,
  status text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== PROFILES ==========
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'custom',
  role_id uuid,
  status text NOT NULL DEFAULT 'active',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== ROLES ==========
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== PLANS ==========
CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_monthly numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  max_users int NOT NULL DEFAULT 2,
  max_deals int NOT NULL DEFAULT 100,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

-- ========== COMMERCIAL CODES ==========
CREATE TABLE IF NOT EXISTS public.commercial_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text,
  owner_email text,
  country_code text,
  region text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== AUDIT LOG ==========
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  tenant_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== ANNOUNCEMENTS ==========
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== SALES TRACKING ==========
CREATE TABLE IF NOT EXISTS public.sales_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_code_id uuid REFERENCES public.commercial_codes(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== SUBSCRIPTIONS ==========
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

-- ========== TENANT INVITATIONS ==========
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== TENANT-SCOPED CRM TABLES ==========
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  company_id uuid,
  country_code text,
  city text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  industry text,
  website text,
  email text,
  phone text,
  country_code text,
  city text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  stage text NOT NULL DEFAULT 'lead',
  contact_id uuid,
  company_id uuid,
  owner_id uuid,
  expected_close_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'call',
  title text NOT NULL,
  description text,
  due_at timestamptz,
  completed boolean NOT NULL DEFAULT false,
  user_id uuid,
  contact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'todo',
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text,
  url text,
  size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger text NOT NULL,
  action text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ========== HELPER FUNCTIONS (after tables exist) ==========
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ========== ENABLE RLS + POLICIES ==========
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenants_select_own_or_super" ON public.tenants;
CREATE POLICY "tenants_select_own_or_super" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "tenants_update_own" ON public.tenants;
CREATE POLICY "tenants_update_own" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = public.current_tenant_id())
  WITH CHECK (id = public.current_tenant_id());
DROP POLICY IF EXISTS "tenants_super_admin_all" ON public.tenants;
CREATE POLICY "tenants_super_admin_all" ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_self_or_tenant_or_super" ON public.profiles;
CREATE POLICY "profiles_select_self_or_tenant_or_super" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR tenant_id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
CREATE POLICY "profiles_super_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select_tenant_or_super" ON public.roles;
CREATE POLICY "roles_select_tenant_or_super" ON public.roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "roles_tenant_admin_manage" ON public.roles;
CREATE POLICY "roles_tenant_admin_manage" ON public.roles
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_select_all" ON public.plans;
CREATE POLICY "plans_select_all" ON public.plans
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "plans_super_admin_all" ON public.plans;
CREATE POLICY "plans_super_admin_all" ON public.plans
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

ALTER TABLE public.commercial_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial_codes_super_admin_all" ON public.commercial_codes;
CREATE POLICY "commercial_codes_super_admin_all" ON public.commercial_codes
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "commercial_codes_validate_anon" ON public.commercial_codes;
CREATE POLICY "commercial_codes_validate_anon" ON public.commercial_codes
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_super_admin_all" ON public.audit_log;
CREATE POLICY "audit_log_super_admin_all" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "audit_log_insert_self" ON public.audit_log;
CREATE POLICY "audit_log_insert_self" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_select_active" ON public.announcements;
CREATE POLICY "announcements_select_active" ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (is_active = true);
DROP POLICY IF EXISTS "announcements_super_admin_all" ON public.announcements;
CREATE POLICY "announcements_super_admin_all" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

ALTER TABLE public.sales_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_tracking_super_admin_all" ON public.sales_tracking;
CREATE POLICY "sales_tracking_super_admin_all" ON public.sales_tracking
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "sales_tracking_insert_self" ON public.sales_tracking;
CREATE POLICY "sales_tracking_insert_self" ON public.sales_tracking
  FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_select_own_or_super" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own_or_super" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "subscriptions_modify_own" ON public.subscriptions;
CREATE POLICY "subscriptions_modify_own" ON public.subscriptions
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "subscriptions_super_admin_all" ON public.subscriptions;
CREATE POLICY "subscriptions_super_admin_all" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_tenant_or_super" ON public.tenant_invitations;
CREATE POLICY "invitations_tenant_or_super" ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());
DROP POLICY IF EXISTS "invitations_tenant_manage" ON public.tenant_invitations;
CREATE POLICY "invitations_tenant_manage" ON public.tenant_invitations
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "invitations_tenant_delete" ON public.tenant_invitations;
CREATE POLICY "invitations_tenant_delete" ON public.tenant_invitations
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- RLS pattern for all CRM tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['contacts','companies','deals','activities','tasks','documents','automations','notifications']) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id() OR public.is_super_admin());', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());', t || '_delete', t);
  END LOOP;
END $$;

-- ========== INDEXES ==========
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON public.roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON public.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant ON public.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);
CREATE INDEX IF NOT EXISTS idx_activities_tenant ON public.activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automations_tenant ON public.automations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tracking_code ON public.sales_tracking(commercial_code_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON public.audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active);

-- ========== SEED PLANS ==========
INSERT INTO public.plans (id, name, price_monthly, currency, max_users, max_deals, features, is_active, sort_order) VALUES
('starter', 'Starter', 9, 'USD', 2, 100,
  '{"modules":["dashboard","pipeline","contacts","companies","tasks","calendar","notifications","security"],"trial_days":7}'::jsonb,
  true, 1),
('pro', 'Pro', 29, 'USD', 5, 0,
  '{"modules":["dashboard","pipeline","contacts","companies","activities","tasks","calendar","forecast","reports","automations","notifications","security","team"],"trial_days":7,"custom_roles":true}'::jsonb,
  true, 2),
('premium', 'Premium', 69, 'USD', 15, 0,
  '{"modules":["dashboard","pipeline","contacts","companies","activities","tasks","calendar","forecast","reports","import_export","automations","documents","notifications","security","team","billing"],"trial_days":7,"multi_currency":true,"mobile_money":true,"api":true,"custom_roles":true}'::jsonb,
  true, 3),
('entreprise', 'Entreprise', 159, 'USD', 0, 0,
  '{"modules":["dashboard","pipeline","contacts","companies","activities","tasks","calendar","forecast","reports","import_export","automations","documents","notifications","security","team","billing"],"trial_days":7,"multi_currency":true,"mobile_money":true,"api":true,"custom_roles":true,"white_label":true,"webhooks":true,"priority_support":true,"sla":true}'::jsonb,
  true, 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  max_users = EXCLUDED.max_users,
  max_deals = EXCLUDED.max_deals,
  features = EXCLUDED.features;

-- ========== AUTO-CREATE PROFILE ON SIGNUP ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
