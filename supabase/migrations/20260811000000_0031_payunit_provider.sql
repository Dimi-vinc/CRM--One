-- ========== PAYUNIT : premier PSP à valider pour la mise en production ==========
-- PayUnit (agrégateur camerounais : Orange Money, MTN Mobile Money, cartes) rejoint Stripe et
-- Flutterwave comme fournisseur de paiement. Son API REST n'a pas de champ "metadata"/"meta"
-- comme Stripe ou Flutterwave pour transporter tenant_id/plan_id jusqu'au webhook — on stocke
-- donc cette correspondance nous-mêmes avant d'appeler PayUnit, avec notre propre transaction_id
-- comme clé (c'est cet identifiant, choisi par nous, qui sert aussi à interroger le statut du
-- paiement directement auprès de PayUnit).

CREATE TABLE IF NOT EXISTS public.payunit_transactions (
  transaction_id text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payunit_transactions_tenant ON public.payunit_transactions(tenant_id);

ALTER TABLE public.payunit_transactions ENABLE ROW LEVEL SECURITY;

-- Server-only table: written by payunit-checkout (creates the pending row) and payunit-webhook
-- (marks it confirmed/failed after re-verifying with PayUnit directly), both using the service
-- role. No policy grants authenticated/anon access — a tenant has no legitimate reason to read or
-- write this table directly; they see the result via their own `subscriptions`/`tenants` rows,
-- which already have their own RLS.
