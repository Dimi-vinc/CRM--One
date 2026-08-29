-- ========== PAYSTACK : troisième PSP (Nigeria, Ghana, Afrique du Sud, Kenya) ==========
-- Même modèle que payunit_transactions (migration 0031) : Paystack accepte un paramètre
-- metadata natif, mais pour rester cohérent avec le pattern déjà éprouvé (et éviter toute
-- dépendance à un round-trip de métadonnées non garanti), on garde notre propre table de
-- corrélation keyée par la référence que NOUS générons — c'est aussi cette référence que
-- Paystack echo de façon fiable et documentée dans sa réponse verify ET son payload webhook.

CREATE TABLE IF NOT EXISTS public.paystack_transactions (
  reference text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paystack_transactions_tenant ON public.paystack_transactions(tenant_id);

ALTER TABLE public.paystack_transactions ENABLE ROW LEVEL SECURITY;

-- Server-only table, same rationale as payunit_transactions: written by paystack-checkout
-- (pending row) and paystack-webhook (confirmed/failed after signature + verify-API check),
-- both via the service role. No policy grants authenticated/anon access.
