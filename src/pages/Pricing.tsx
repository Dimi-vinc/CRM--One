import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSelector } from '../components/LanguageSelector';
import { Footer } from './Landing';
import { PLANS, formatMoney } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';

export function Pricing() {
  const { t, lang } = useLanguage();
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Link to="/" className="btn-ghost"><ArrowLeft size={16} /> {lang === 'fr' ? 'Accueil' : 'Home'}</Link>
            <Link to="/login" className="btn-secondary-landing">{t('nav.login')}</Link>
            <Link to="/signup" className="btn-primary-landing">{t('nav.signup')}</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold text-gray-900">{lang === 'fr' ? 'Des forfaits adaptés à chaque étape' : 'Plans for every stage'}</h1>
          <p className="mt-4 text-lg text-gray-600">{lang === 'fr' ? '7 jours d\'essai gratuit sur tous les plans. Sans carte bancaire. Changez de plan à tout moment.' : '7-day free trial on all plans. No credit card. Change anytime.'}</p>

          {/* Monthly / Annual toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-gray-100 p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${!annual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {lang === 'fr' ? 'Mensuel' : 'Monthly'}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition ${annual ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              {lang === 'fr' ? 'Annuel' : 'Annual'}
              <span className="rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-bold text-mint-700">-20%</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => {
            const price = annual ? plan.priceAnnual : plan.price;
            return (
              <div key={plan.id} className={`card flex flex-col p-6 ${plan.highlight ? 'ring-2 ring-blue-500 border-blue-300' : ''}`}>
                {plan.highlight && <div className="mb-2 inline-flex w-fit rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">{t('common.popular')}</div>}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-3">
                  <span className="text-3xl font-bold text-gray-900">{formatMoney(price, plan.currency)}</span>
                  <span className="text-sm text-gray-500">{t('common.perMonth')}</span>
                </p>
                {annual && (
                  <p className="mt-1 text-xs text-mint-600 font-medium">
                    {lang === 'fr' ? 'Économisez' : 'Save'} {formatMoney((plan.price - plan.priceAnnual) * 12, plan.currency)} {lang === 'fr' ? '/an' : '/yr'}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  {plan.maxUsers === 0 ? t('common.unlimited') : `${t('common.upTo')} ${plan.maxUsers}`} {t('common.users')}
                  {' · '}
                  {plan.maxDeals === 0 ? (lang === 'fr' ? 'Deals illimités' : 'Unlimited deals') : `${t('common.upTo')} ${plan.maxDeals} deals`}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-gray-600">
                  {plan.features.map(f => (
                    <li key={f} className="flex gap-2">
                      <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-mint-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`mt-6 ${plan.highlight ? 'btn-primary-landing' : 'btn-secondary-landing'}`}>
                  {t('landing.tryFree')}
                </Link>
                <p className="mt-2 text-center text-xs text-gray-400">{lang === 'fr' ? '7 jours d\'essai · Sans carte' : '7-day trial · No card'}</p>
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="mt-16 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-3 font-semibold text-gray-900">{lang === 'fr' ? 'Fonctionnalité' : 'Feature'}</th>
                {PLANS.map(p => <th key={p.id} className="px-4 py-3 font-semibold text-gray-900">{p.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { l: 'Pipeline', v: [true, true, true, true] },
                { l: lang === 'fr' ? 'Contacts & Companies' : 'Contacts & Companies', v: [true, true, true, true] },
                { l: lang === 'fr' ? 'Tâches & Calendrier' : 'Tasks & Calendar', v: [true, true, true, true] },
                { l: lang === 'fr' ? 'Activités' : 'Activities', v: [false, true, true, true] },
                { l: 'Forecast', v: [false, true, true, true] },
                { l: lang === 'fr' ? 'Rapports avancés' : 'Advanced reports', v: [false, true, true, true] },
                { l: lang === 'fr' ? 'Rôles personnalisés' : 'Custom roles', v: [false, true, true, true] },
                { l: lang === 'fr' ? 'Automatisations' : 'Automations', v: [false, lang === 'fr' ? 'Base' : 'Basic', lang === 'fr' ? 'Avancées' : 'Advanced', lang === 'fr' ? 'Avancées' : 'Advanced'] },
                { l: lang === 'fr' ? 'Documents' : 'Documents', v: [false, false, true, true] },
                { l: 'Import/Export', v: [false, false, true, true] },
                { l: lang === 'fr' ? 'Multi-devise & Mobile Money' : 'Multi-currency & Mobile Money', v: [false, false, true, true] },
                { l: 'API', v: [false, false, true, lang === 'fr' ? 'Complète' : 'Full'] },
                { l: lang === 'fr' ? 'Marque blanche' : 'White label', v: [false, false, false, lang === 'fr' ? 'Partielle' : 'Partial'] },
                { l: lang === 'fr' ? 'Support prioritaire + SLA' : 'Priority support + SLA', v: [false, false, false, true] },
              ].map(row => (
                <tr key={row.l}>
                  <td className="py-3 text-gray-700">{row.l}</td>
                  {row.v.map((val, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {val === true ? <CheckCircle2 size={16} className="mx-auto text-mint-600" /> :
                       val === false ? <span className="text-gray-300">—</span> :
                       <span className="text-xs font-medium text-gray-700">{val}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Footer onManageCookies={() => window.__crmOneOpenCookies?.()} />
    </div>
  );
}
