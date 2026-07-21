import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, MapPin, Coins, CreditCard, Gift } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSelector } from '../components/LanguageSelector';
import { Button, Input, Select } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { COUNTRIES, COUNTRY_BY_CODE, CURRENCIES, PLANS, PLAN_BY_ID, formatMoney, PLATFORM_NAME } from '../lib/constants';

const STEPS = ['onboarding.location', 'onboarding.currency', 'onboarding.plan', 'onboarding.comCode'] as const;

export function Onboarding() {
  const { t } = useLanguage();
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

      // Single atomic RPC: bypasses all RLS (SECURITY DEFINER, runs as postgres).
      // Does tenant insert + profile promote + subscription + roles + tracking in one transaction.
      const { data: tenantId, error: rpcErr } = await supabase.rpc('complete_onboarding', {
        p_company_name: companyName || 'Mon entreprise',
        p_country_code: country,
        p_region: region || '',
        p_city: city || '',
        p_currency_code: currency,
        p_timezone: countryDef?.timezone || 'Africa/Douala',
        p_locale: 'fr',
        p_phone_country_code: countryDef?.dial || '+237',
        p_plan_id: planId,
        p_full_name: initialName || user.email,
        p_commercial_code: commercialCode.trim() || null,
      });
      if (rpcErr) throw rpcErr;
      if (!tenantId) throw new Error('La création du compte a échoué.');

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
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Button variant="ghost" onClick={() => supabase.auth.signOut().then(() => nav('/login'))}>{t('nav.logout')}</Button>
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i < step ? 'bg-mint-500 text-white' : i === step ? 'bg-coral-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`hidden text-xs sm:inline ${i === step ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{t(s)}</span>
              {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? 'bg-mint-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="mt-8 card p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><MapPin className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">{t('onboarding.location')}</h2></div>
              <Input label={t('onboarding.companyName')} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme SARL" />
              <Select label={t('onboarding.country')} value={country} onChange={e => onCountryChange(e.target.value)} hint="54 pays africains + pays internationaux">
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Select label={t('onboarding.region')} value={region} onChange={e => setRegion(e.target.value)}>
                  {countryDef?.regions.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
                <Input label={t('onboarding.city')} value={city} onChange={e => setCity(e.target.value)} placeholder="Ville" hint="Saisie libre" />
              </div>
              <p className="rounded-lg bg-mint-50 p-3 text-xs text-mint-700">{t('onboarding.timezone')} : <b>{countryDef?.timezone}</b> · {t('onboarding.dial')} : <b>{countryDef?.dial}</b></p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><Coins className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">{t('onboarding.chooseCurrency')}</h2></div>
              <p className="text-sm text-gray-500">{t('onboarding.currencyHint')}</p>
              <Select label={t('common.currency')} value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
              </Select>
              <p className="rounded-lg bg-coral-50 p-3 text-xs text-coral-700">{t('onboarding.recommended')} : <b>{countryDef?.currency}</b></p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2"><CreditCard className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">{t('onboarding.choosePlan')}</h2></div>
              <p className="text-sm text-gray-500">{t('onboarding.planHint')}</p>
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
              <div className="flex items-center gap-2"><Gift className="text-coral-500" size={20} /><h2 className="text-lg font-bold text-gray-900">{t('onboarding.comCodeTitle')}</h2></div>
              <Input
                label={`${t('onboarding.comCode')} (${t('common.optional')})`}
                value={commercialCode}
                onChange={e => { setCommercialCode(e.target.value); setCodeValid(null); }}
                onBlur={validateCode}
                placeholder={t('onboarding.comCodePlaceholder')}
                hint={t('onboarding.comCodeHint')}
              />
              {codeValid?.ok && <p className="rounded-lg bg-mint-50 p-3 text-xs text-mint-700">{t('onboarding.codeValid')} : <b>{codeValid.label}</b></p>}
              {codeValid && !codeValid.ok && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{t('onboarding.codeInvalid')}</p>}
              <div className="rounded-xl bg-mint-50/60 p-4">
                <h3 className="text-sm font-semibold text-gray-900">{t('onboarding.summary')}</h3>
                <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                  <dt>{t('common.company')}</dt><dd className="text-right font-medium text-gray-900">{companyName}</dd>
                  <dt>{t('common.country')}</dt><dd className="text-right font-medium text-gray-900">{countryDef?.name}</dd>
                  <dt>{t('common.currency')}</dt><dd className="text-right font-medium text-gray-900">{currency}</dd>
                  <dt>{t('common.plan')}</dt><dd className="text-right font-medium text-gray-900">{PLAN_BY_ID[planId].name}</dd>
                  <dt>{t('onboarding.trialLabel')}</dt><dd className="text-right font-medium text-mint-700">{t('onboarding.trialValue')}</dd>
                </dl>
              </div>
            </div>
          )}

          {error && <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={prev} disabled={step === 0 || submitting}><ArrowLeft size={16} /> {t('onboarding.back')}</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!canNext()}>{t('onboarding.continue')} <ArrowRight size={16} /></Button>
            ) : (
              <Button onClick={finish} disabled={submitting}>{submitting ? t('onboarding.configuring') : t('onboarding.startTrial')}</Button>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">{PLATFORM_NAME} · LIYHA GROUP</p>
      </div>
    </div>
  );
}
