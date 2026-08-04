import { useEffect, useState } from 'react';
import { CreditCard, Check, AlertCircle, Loader2, Crown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Button, Badge, Skeleton } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { PLANS, PLAN_BY_ID, formatMoney } from '../../lib/constants';
import { daysUntil, formatDate } from '../../lib/utils';
import { startCheckout, getPaymentProvider } from '../../lib/payments';
import type { Subscription } from '../../lib/types';

export function Billing() {
  const { tenant, profile } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'flutterwave'>(() => {
    if (typeof window === 'undefined') return 'stripe';
    const stored = localStorage.getItem('crm_payment_provider');
    return stored === 'flutterwave' ? 'flutterwave' : 'stripe';
  });

  const load = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('subscriptions').select('*').eq('tenant_id', tenant.id).maybeSingle();
    setSub(data as Subscription | null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tenant]);

  const trialLeft = tenant?.trial_ends_at ? daysUntil(tenant.trial_ends_at) : null;
  const currentPlan = PLAN_BY_ID[tenant?.plan_id || 'starter'];
  const paymentRequired = tenant?.status !== 'active' && trialLeft !== null && trialLeft < 0;

  const checkout = async (planId: 'starter' | 'pro' | 'premium' | 'entreprise') => {
    if (!tenant || !profile) return;
    setError(null); setNote(null); setBusy(planId);
    const res = await startCheckout({
      planId,
      currency: tenant.currency_code,
      tenantId: tenant.id,
      email: profile.email,
      successUrl: `${window.location.origin}/billing?status=success&plan=${planId}`,
      cancelUrl: `${window.location.origin}/billing?status=cancel`,
      provider: selectedProvider,
    });
    setBusy(null);
    if (!res.ok) {
      if (res.error?.includes('non encore configuré') || res.error?.includes('Stripe') || res.error?.includes('Flutterwave')) {
        setError(`${selectedProvider === 'stripe' ? 'Stripe' : 'Flutterwave'} n'est pas encore configuré sur cette instance de test. Veuillez configurer les clés d'API correspondantes.`);
      } else {
        setError(res.error || 'Échec du paiement');
      }
      return;
    }
    if (res.url) window.location.href = res.url;
  };

  const openPortal = async () => {
    if (!tenant) return;
    setBusy('portal'); setError(null);
    const provider = getPaymentProvider('stripe');
    const res = await provider.createPortalSession(tenant.id, `${window.location.origin}/billing`);
    setBusy(null);
    if (res.ok && res.url) window.location.href = res.url;
    else setError(res.error || 'Portail indisponible. Souscrivez d\'abord à un plan.');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_payment_provider', selectedProvider);
    }
  }, [selectedProvider]);

  // Handle redirect status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      // The actual plan activation happens server-side via the payment provider's webhook
      // (stripe-webhook / flutterwave-webhook), which is the only trustworthy source of truth
      // for "was this really paid". We never set plan_id/status from a client-side URL param —
      // that was a full billing-bypass vulnerability (anyone could type this URL and get any
      // plan for free). We just poll briefly for the webhook to land, then refresh.
      setNote('Paiement en cours de confirmation…');
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data } = await supabase.from('tenants').select('status').eq('id', tenant?.id).maybeSingle();
        if (data?.status === 'active' || attempts >= 10) {
          clearInterval(poll);
          if (data?.status === 'active') { setNote('Paiement confirmé, votre plan est actif.'); window.location.reload(); }
          else setNote("Paiement reçu par le fournisseur, en attente de confirmation finale. Actualisez la page dans une minute si le plan ne se met pas à jour.");
        }
      }, 2000);
      return () => clearInterval(poll);
    } else if (status === 'cancel') {
      setError('Paiement annulé. Vous pouvez réessayer à tout moment.');
    }
  }, [tenant]);

  return (
    <div>
      <PageHeader title="Facturation" subtitle="Gérez votre abonnement et vos paiements" />

      {note && <div className="mb-4 flex items-start gap-2 rounded-lg bg-mint-50 p-3 text-sm text-mint-800"><Check size={16} className="mt-0.5" />{note}</div>}
      {error && <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5" />{error}</div>}
      {paymentRequired && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Votre essai gratuit est terminé.</p>
            <p className="mt-0.5">L'accès aux autres modules est suspendu jusqu'à la souscription d'un plan. Choisissez un forfait ci-dessous pour réactiver votre compte immédiatement.</p>
          </div>
        </div>
      )}
      {sub && sub.status && sub.status !== 'active' && !paymentRequired && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>Statut de votre abonnement : <b>{sub.status}</b>.</span>
        </div>
      )}

      {/* Current plan card */}
      <Card edge="orange" className="mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Plan actuel</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{currentPlan?.name} — {formatMoney(currentPlan?.price || 0, currentPlan?.currency || 'USD')}/mois</p>
            {trialLeft !== null && trialLeft >= 0 && (
              <p className="mt-2"><Badge color="orange">Essai : {trialLeft}j restants</Badge> <span className="text-xs text-gray-500"> · jusqu'au {formatDate(tenant?.trial_ends_at)}</span></p>
            )}
            {trialLeft !== null && trialLeft < 0 && (
              <p className="mt-2"><Badge color="red">Essai expiré</Badge> <span className="text-xs text-gray-500"> — souscrivez pour réactiver l'écriture.</span></p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={openPortal} disabled={busy === 'portal'}>
              {busy === 'portal' ? <><Loader2 size={16} className="animate-spin" /> Ouverture…</> : <><CreditCard size={16} /> Gérer ma carte</>}
            </Button>
          </div>
        </div>
      </Card>

      {/* Choice of Payment Provider (Stripe vs Flutterwave) - Microsoft 365 style */}
      <Card className="mb-6 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">1. Mode de règlement préféré</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => setSelectedProvider('stripe')}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all focus:outline-none ${selectedProvider === 'stripe' ? 'border-coral-500 ring-2 ring-coral-100 bg-coral-50/10' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <div className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${selectedProvider === 'stripe' ? 'border-coral-500 text-coral-600' : 'border-gray-300'}`}>
              <div className={`h-2 w-2 rounded-full ${selectedProvider === 'stripe' ? 'bg-coral-500' : 'bg-transparent'}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Carte Bancaire Internationale (Stripe)</p>
              <p className="mt-0.5 text-xs text-gray-500">Visa, Mastercard, AMEX, Apple Pay & Google Pay.</p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">Visa</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">Mastercard</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">AMEX</span>
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedProvider('flutterwave')}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all focus:outline-none ${selectedProvider === 'flutterwave' ? 'border-coral-500 ring-2 ring-coral-100 bg-coral-50/10' : 'border-gray-200 hover:bg-gray-50'}`}
          >
            <div className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full border ${selectedProvider === 'flutterwave' ? 'border-coral-500 text-coral-600' : 'border-gray-300'}`}>
              <div className={`h-2 w-2 rounded-full ${selectedProvider === 'flutterwave' ? 'bg-coral-500' : 'bg-transparent'}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Mobile Money & Cartes Locales (Flutterwave)</p>
              <p className="mt-0.5 text-xs text-gray-500">Orange Money, MTN MoMo, Wave, M-Pesa & Cartes africaines.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded bg-coral-50 px-1.5 py-0.5 text-[10px] font-bold text-coral-700">Orange Money</span>
                <span className="rounded bg-coral-50 px-1.5 py-0.5 text-[10px] font-bold text-coral-700">MTN MoMo</span>
                <span className="rounded bg-coral-50 px-1.5 py-0.5 text-[10px] font-bold text-coral-700">Wave</span>
                <span className="rounded bg-coral-50 px-1.5 py-0.5 text-[10px] font-bold text-coral-700">M-Pesa</span>
              </div>
            </div>
          </button>
        </div>
      </Card>

      {/* Plans grid */}
      <h3 className="mb-3 text-base font-semibold text-gray-900">2. Sélectionnez un forfait</h3>
      {loading ? <Skeleton className="h-48" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(p => {
            const isCurrent = p.id === tenant?.plan_id;
            return (
              <Card key={p.id} className={`p-5 flex flex-col ${p.highlight ? 'ring-2 ring-coral-300 border-coral-300' : ''}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">{p.name}</h3>
                  {p.highlight && <Crown size={16} className="text-coral-500" />}
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatMoney(p.price, p.currency)}<span className="text-sm font-normal text-gray-500">/mois</span></p>
                <ul className="mt-3 flex-1 space-y-1.5 text-xs text-gray-600">
                  {p.features.slice(0, 4).map(f => <li key={f} className="flex gap-1.5"><Check size={14} className="text-mint-600 flex-shrink-0" />{f}</li>)}
                </ul>
                <Button className="mt-4" disabled={isCurrent || busy === p.id} onClick={() => checkout(p.id)} variant={p.highlight ? 'primary' : 'secondary'}>
                  {busy === p.id ? <><Loader2 size={16} className="animate-spin" /> Redirection…</> : isCurrent ? 'Plan actuel' : `Passer à ${p.name}`}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-6 p-5">
        <h3 className="font-semibold text-gray-900">Moyens de paiement disponibles</h3>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className={`rounded-lg border px-3 py-1.5 ${selectedProvider === 'stripe' ? 'border-coral-500 bg-coral-50/20 text-coral-700 font-semibold' : 'border-gray-200 text-gray-400'}`}>Cartes bancaires (Stripe)</span>
          <span className={`rounded-lg border px-3 py-1.5 ${selectedProvider === 'flutterwave' ? 'border-coral-500 bg-coral-50/20 text-coral-700 font-semibold' : 'border-gray-200 text-gray-400'}`}>Orange Money (Flutterwave)</span>
          <span className={`rounded-lg border px-3 py-1.5 ${selectedProvider === 'flutterwave' ? 'border-coral-500 bg-coral-50/20 text-coral-700 font-semibold' : 'border-gray-200 text-gray-400'}`}>MTN Mobile Money (Flutterwave)</span>
          <span className={`rounded-lg border px-3 py-1.5 ${selectedProvider === 'flutterwave' ? 'border-coral-500 bg-coral-50/20 text-coral-700 font-semibold' : 'border-gray-200 text-gray-400'}`}>Wave (Flutterwave)</span>
          <span className={`rounded-lg border px-3 py-1.5 ${selectedProvider === 'flutterwave' ? 'border-coral-500 bg-coral-50/20 text-coral-700 font-semibold' : 'border-gray-200 text-gray-400'}`}>M-Pesa (Flutterwave)</span>
        </div>
        <p className="mt-3 text-xs text-gray-500">Les moyens de paiement sont proposés de manière dynamique et sécurisée selon votre mode de règlement préféré et la devise du compte.</p>
      </Card>
    </div>
  );
}
