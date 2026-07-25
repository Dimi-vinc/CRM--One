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
    });
    setBusy(null);
    if (!res.ok) {
      if (res.error?.includes('non encore configuré') || (res as any).error?.includes('Stripe')) {
        setError('Stripe n\'est pas encore configuré. Activez Stripe pour accepter les paiements (voir le message à la fin de la livraison).');
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

  // Handle redirect status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      const plan = params.get('plan');
      setNote(`Paiement réussi. Votre plan ${plan || ''} est actif.`);
      // update tenant plan + subscription status (best-effort; Stripe webhook would normally do this)
      if (tenant && plan) {
        supabase.from('tenants').update({ plan_id: plan, status: 'active' }).eq('id', tenant.id).then(() => window.location.reload());
      }
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

      {/* Plans grid */}
      <h3 className="mb-3 text-base font-semibold text-gray-900">Changer de forfait</h3>
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
        <h3 className="font-semibold text-gray-900">Moyens de paiement</h3>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-lg border border-gray-200 px-3 py-1.5">Cartes bancaires (Stripe)</span>
          <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">Orange Money</span>
          <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">MTN Mobile Money</span>
          <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">Wave</span>
          <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">M-Pesa</span>
        </div>
        <p className="mt-3 text-xs text-gray-500">Mobile Money sera proposé dynamiquement selon le pays. Une couche d'abstraction permet d'ajouter Flutterwave sans tout refaire.</p>
      </Card>
    </div>
  );
}
