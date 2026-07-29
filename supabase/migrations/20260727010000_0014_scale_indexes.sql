-- ========== INDEX DE PERFORMANCE POUR LA MONTÉE EN CHARGE ==========
-- Les index précédents ne portaient que sur tenant_id seul. À l'échelle (des dizaines de
-- milliers de lignes par tenant), toute liste triée par date nécessite un index composite
-- (tenant_id, created_at DESC) pour éviter un tri complet en mémoire à chaque requête.

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_created ON public.contacts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_email ON public.contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_created ON public.companies(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_tenant_name ON public.companies(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_created ON public.deals(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_tenant_owner_stage ON public.deals(tenant_id, owner_id, stage);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_due ON public.activities(tenant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_due ON public.tasks(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_created ON public.documents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant_created ON public.quotes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON public.invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_created ON public.email_campaigns(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- Full-text-ish search helpers: case-insensitive prefix search on the fields the UI actually
-- filters/searches by (Contacts/Companies search boxes).
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts(tenant_id, lower(first_name), lower(last_name));
CREATE INDEX IF NOT EXISTS idx_companies_name_lower ON public.companies(tenant_id, lower(name));
