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
  phone?: string | null;
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
  features: Record<string, unknown>;
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
  details?: unknown;
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
  marketing_consent?: boolean;
  consent_updated_at?: string | null;
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

// ---- Tickets ----
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  company_id: string | null;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  sla_due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketComment {
  id: string;
  tenant_id: string;
  ticket_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

// ---- Devis & Factures ----
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface LineItem {
  id: string;
  tenant_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  position: number;
}

export interface Quote {
  id: string;
  tenant_id: string;
  quote_number: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  status: QuoteStatus;
  currency_code: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}
export interface QuoteItem extends LineItem { quote_id: string; }

export interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  contact_id: string | null;
  company_id: string | null;
  quote_id: string | null;
  status: InvoiceStatus;
  currency_code: string;
  issued_date: string;
  due_date: string | null;
  notes: string | null;
  created_at: string;
}
export interface InvoiceItem extends LineItem { invoice_id: string; }

// ---- Campagnes email ----
export type CampaignStatus = 'draft' | 'sending' | 'sent';

export interface EmailCampaign {
  id: string;
  tenant_id: string;
  name: string;
  subject: string;
  body_html: string;
  status: CampaignStatus;
  segment_country_code: string | null;
  segment_min_score: number | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailCampaignRecipient {
  id: string;
  tenant_id: string;
  campaign_id: string;
  contact_id: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped_no_consent';
  error: string | null;
  sent_at: string | null;
}

// ---- Base de connaissances ----
export interface KbArticle {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  content: string;
  category: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// ---- Formulaires web ----
export type WebFormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'consent';
export interface WebFormField {
  key: string;
  label: string;
  type: WebFormFieldType;
  required?: boolean;
}

export interface WebForm {
  id: string;
  tenant_id: string;
  name: string;
  fields: WebFormField[];
  success_message: string;
  redirect_url: string | null;
  is_active: boolean;
  submission_count: number;
  created_at: string;
}

export interface WebFormSubmission {
  id: string;
  tenant_id: string;
  form_id: string;
  contact_id: string | null;
  data: Record<string, string | boolean>;
  created_at: string;
}

// ---- Territoires & quotas ----
export interface SalesTerritory {
  id: string;
  tenant_id: string;
  name: string;
  country_codes: string[];
  owner_id: string | null;
  created_at: string;
}

export interface SalesQuota {
  id: string;
  tenant_id: string;
  user_id: string;
  period: string;
  target_amount: number;
  currency_code: string;
  created_at: string;
}
