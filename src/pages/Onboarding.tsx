import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, MapPin, Coins, CreditCard, Gift } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button, Input, Select } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COUNTRIES, COUNTRY_BY_CODE, CURRENCIES, PLANS, PLAN_BY_ID, formatMoney, PLATFORM_NAME } from '../lib/constants';

const STEPS = ['Localisation', 'Devise', 'Forfait', 'Code commercial'] as const;

export function Onboarding() {
  const nav = useNavigate();
  const loc = useLocation();
  const { refresh } = useAuth();
  const initialCompany = (loc.state as any)?.companyName || '';
  const initialName = (loc.state as any)?.fullName || '';

  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState(initialCompany);
  const [country, setCountry] = useState('CM');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [planId, setPlanId] = useState<'starter'|'pro'|'premium'|'entreprise'>('pro');
  const [commercialCode, setCommercialCode] = useState('');
  const [codeValid, setCodeValid] = useState<null | { ok: boolean; label?: string }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countryDef = COUNTRY_BY_CODE[country];

  const onCountryChange = (code: string) => {
    setCountry(code);
    const c = COUNTRY_BY_CODE[code];
    setCurrency(c.currency);
    setRegion(c.regions[0] || '');
  };

  const validateCode = async () => {
    if (!commercialCode.trim()) { setCodeValid(null); return; }
    const { data } = await supabase.from('commercial_codes').select('label, code').eq('code', commercialCode.trim()).eq('is_active', true).maybeSingle();
    setCodeValid(data ? { ok: true, label: data.label } : { ok: false });
  };

  const finish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expirée');

      // 1) Create tenant
      const { data: tenant, error: tErr } = await supabase.from('tenants').insert({
        name: companyName || 'Mon entreprise',
        country_code: country,
        region,
        city,
        currency_code: currency,
        timezone: countryDef?.timezone || 'Africa/Douala',
        locale: 'fr',
        phone_country_code: countryDef?.dial || '+237',
        plan_id: planId,
        trial_ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'trial',
      }).select().single();
      if (tErr) throw tErr;

      // 2) Promote this user to admin of the tenant
      const { error: pErr } = await supabase.from('profiles').update({
        tenant_id: tenant.id, role: 'admin', full_name: initialName || user.email,
      }).eq('id', user.id);
      if (pErr) throw pErr;

      // 3) Create a subscription row in trialing state
      await supabase.from('subscriptions').insert({
        tenant_id: tenant.id, plan_id: planId, status: 'trialing',
        current_period_end: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      // 4) Commercial code tracking link (optional)
      if (commercialCode.trim()) {
        const { data: code } = await supabase.from('commercial_codes').select('id').eq('code', commercialCode.trim()).eq('is_active', true).maybeSingle();
        if (code) {
          await supabase.from('sales_tracking').insert({
            commercial_code_id: code.id, tenant_id: tenant.id, amount: PLAN_BY_ID[planId].price, currency: PLAN_BY_ID[planId].currency,
          });
        }
      }

      // 5) Seed default custom roles
      await supabase.from('roles').insert([
        { tenant_id: tenant.id, name: 'Commercial', description: 'Accès pipeline et deals', permissions: { pipeline: ['view','create','edit'], contacts: ['view','create','edit'], companies: ['view','create','edit'] } },
        { tenant_id: tenant.id, name: 'Comptable', description: 'Accès facturation et rapports financiers', permissions: { billing: ['view'], reports: ['view'] } },
        { tenant_id: tenant.id, name: 'Fonctionnel / Support', description: 'Configuration et support', permissions: { contacts: ['view'], tasks: ['view','create','edit'] } },
      ]);

      await refresh();
      nav('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la configuration');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const canNext = () => {
    if (step === 0) return !!companyName.trim() && !!country;
    if (step === 1) return !!currency;
    if (step === 2) return !!planId;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-mint-50/40 to-white">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <Logo />
          <Button variant="ghost" onClick={() => supabase.auth.signOut().then(() => nav('/login'))}>Se déconnecter</Button>
        </div>

        {/* Stepper */}
        <div className="mt-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i < step ? 'bg-mint-500 text-white' : i === step ? 'bg-coral-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`hidden text-xs sm:inline ${i === step ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? 'bg-mint-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="mt-8 card p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><MapPin className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">Localisation de votre entreprise</h2></div>
              <Input label="Nom de l'entreprise" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme SARL" />
              <Select label="Pays" value={country} onChange={e => onCountryChange(e.target.value)} hint="54 pays africains + pays internationaux">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Région / Province" value={region} onChange={e => setRegion(e.target.value)}>
                  {countryDef?.regions.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
                <Input label="Ville" value={city} onChange={e => setCity(e.target.value)} placeholder="Ville" hint="Saisie libre" />
              </div>
              <p className="rounded-lg bg-mint-50 p-3 text-xs text-mint-700">Fuseau horaire : <b>{countryDef?.timezone}</b> · Indicatif : <b>{countryDef?.dial}</b></p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Coins className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">Choisissez votre devise</h2></div>
              <p className="text-sm text-gray-500">Cette devise sera cohérente dans tout votre compte : rapports, factures, dashboards, exports.</p>
              <Select label="Devise" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
              </Select>
              <p className="rounded-lg bg-coral-50 p-3 text-xs text-coral-700">Recommandé pour votre pays : <b>{countryDef?.currency}</b></p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><CreditCard className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">Choisissez votre forfait</h2></div>
              <p className="text-sm text-gray-500">7 jours d'essai gratuit. Sans carte bancaire. Modifiable à tout moment.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {PLANS.map(p => (
                  <button key={p.id} onClick={() => setPlanId(p.id)} className={`text-left rounded-xl border p-4 transition ${planId === p.id ? 'border-coral-400 ring-2 ring-coral-100 bg-coral-50/40' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{p.name}</h3>
                      {p.highlight && <span className="rounded-full bg-coral-100 px-2 py-0.5 text-[10px] font-semibold text-coral-700">Populaire</span>}
                    </div>
                    <p className="mt-1 text-lg font-bold text-gray-900">{formatMoney(p.price, p.currency)}<span className="text-xs font-normal text-gray-500">/mois</span></p>
                    <p className="mt-1 text-xs text-gray-500">{p.maxUsers === 0 ? 'Illimité' : `Jusqu'à ${p.maxUsers}`} utilisateurs</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Gift className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">Code commercial</h2></div>
              <Input
                label="Code commercial (optionnel)"
                value={commercialCode}
                onChange={e => { setCommercialCode(e.target.value); setCodeValid(null); }}
                onBlur={validateCode}
                placeholder="Laissez vide si vous n'en avez pas"
                hint="Laissez vide si vous n'en avez pas. Ce champ n'est jamais requis."
              />
              {codeValid?.ok && <p className="rounded-lg bg-mint-50 p-3 text-xs text-mint-700">Code valide : <b>{codeValid.label}</b></p>}
              {codeValid && !codeValid.ok && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">Code non reconnu. Vous pouvez continuer sans code.</p>}
              <div className="rounded-xl bg-mint-50/60 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Récapitulatif</h3>
                <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                  <dt>Entreprise</dt><dd className="text-right font-medium text-gray-900">{companyName}</dd>
                  <dt>Pays</dt><dd className="text-right font-medium text-gray-900">{countryDef?.name}</dd>
                  <dt>Devise</dt><dd className="text-right font-medium text-gray-900">{currency}</dd>
                  <dt>Forfait</dt><dd className="text-right font-medium text-gray-900">{PLAN_BY_ID[planId].name}</dd>
                  <dt>Essai</dt><dd className="text-right font-medium text-mint-700">7 jours gratuits</dd>
                </dl>
              </div>
            </div>
          )}

          {error && <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={prev} disabled={step === 0 || submitting}><ArrowLeft size={16} /> Retour</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!canNext()}>Continuer <ArrowRight size={16} /></Button>
            ) : (
              <Button onClick={finish} disabled={submitting}>{submitting ? 'Configuration…' : 'Démarrer mon essai'}</Button>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">{PLATFORM_NAME} · LIYHA GROUP</p>
      </div>
    </div>
  );
}
