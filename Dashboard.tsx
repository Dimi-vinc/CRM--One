// Database row types (loose-typed; matches the schema in 0001_saas_multitenant_foundation migration).

export interface Tenant {
  id: string;
  name: string;
  country_code: string;
  region?: string | null;
  city?: string | null;
  currency_code: string;
  timezone: string;
  locale: string;
  phone_country_code: string;
  plan_id: string;
  trial_ends_at?: string | null;
  status: string;
  created_at: string;
}

export type Role = 'super_admin' | 'admin' | 'custom';

export interface Profile {
  id: string;
  email: string;
  full_name?: string | null;
  tenant_id?: string | null;
  role: Role;
  role_id?: string | null;
  status: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface CustomRole {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  permissions: Record<string, ('view' | 'create' | 'edit' | 'delete')[]>;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  currency: string;
  max_users: number;
  max_deals: number;
  features: Record<string, any>;
  is_active: boolean;
  sort_order: number;
}

export interface CommercialCode {
  id: string;
  code: string;
  label?: string | null;
  owner_email?: string | null;
  country_code?: string | null;
  region?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  tenant_id?: string | null;
  details?: any;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  current_period_end?: string | null;
  created_at: string;
}

export interface SalesTracking {
  id: string;
  commercial_code_id?: string | null;
  tenant_id?: string | null;
  amount: number;
  currency: string;
  created_at: string;
}

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role_id?: string | null;
  token: string;
  status: string;
  created_at: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_id?: string | null;
  country_code?: string | null;
  city?: string | null;
  owner_id?: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  country_code?: string | null;
  city?: string | null;
  owner_id?: string | null;
  created_at: string;
}

export interface Deal {
  id: string;
  tenant_id: string;
  title: string;
  amount: number;
  currency_code: string;
  stage: string;
  contact_id?: string | null;
  company_id?: string | null;
  owner_id?: string | null;
  expected_close_date?: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  tenant_id: string;
  type: string;
  title: string;
  description?: string | null;
  due_at?: string | null;
  completed: boolean;
  user_id?: string | null;
  contact_id?: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority: string;
  status: string;
  assigned_to?: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  tenant_id: string;
  name: string;
  type?: string | null;
  url?: string | null;
  size?: number | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface Automation {
  id: string;
  tenant_id: string;
  name: string;
  trigger: string;
  action: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface AutomationRun {
  id: string;
  tenant_id: string;
  automation_id: string | null;
  trigger: string;
  action: string | null;
  status: 'success' | 'error' | 'skipped';
  detail: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  title: string;
  body?: string | null;
  read: boolean;
  created_at: string;
}
