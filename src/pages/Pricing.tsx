import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Footer } from './Landing';
import { PLANS, formatMoney } from '../lib/constants';

export function Pricing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/" className="btn-ghost"><ArrowLeft size={16} /> Accueil</Link>
            <Link to="/login" className="btn-secondary">Connexion</Link>
            <Link to="/signup" className="btn-primary">Essai gratuit</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold text-gray-900">Des forfaits adaptés à chaque étape</h1>
          <p className="mt-4 text-lg text-gray-600">7 jours d'essai gratuit sur tous les plans. Sans carte bancaire. Changez de plan à tout moment.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => (
            <div key={plan.id} className={`card flex flex-col p-6 ${plan.highlight ? 'ring-2 ring-coral-400 border-coral-300' : ''}`}>
              {plan.highlight && <div className="mb-2 inline-flex w-fit rounded-full bg-coral-100 px-2.5 py-0.5 text-xs font-semibold text-coral-700">Le plus populaire</div>}
              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              <p className="mt-3">
                <span className="text-3xl font-bold text-gray-900">{formatMoney(plan.price, plan.currency)}</span>
                <span className="text-sm text-gray-500">/mois</span>
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {plan.maxUsers === 0 ? 'Utilisateurs illimités' : `Jusqu'à ${plan.maxUsers} utilisateurs`}
                {' · '}
                {plan.maxDeals === 0 ? 'Deals illimités' : `Jusqu'à ${plan.maxDeals} deals`}
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-gray-600">
                {plan.features.map(f => (
                  <li key={f} className="flex gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-mint-600" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/signup" className={`mt-6 ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}>
                Essayer gratuitement
              </Link>
              <p className="mt-2 text-center text-xs text-gray-400">7 jours d'essai · Sans carte</p>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="mt-16 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="py-3 font-semibold text-gray-900">Fonctionnalité</th>
                {PLANS.map(p => <th key={p.id} className="px-4 py-3 font-semibold text-gray-900">{p.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { l: 'Pipeline', v: [true, true, true, true] },
                { l: 'Contacts & Companies', v: [true, true, true, true] },
                { l: 'Tâches & Calendrier', v: [true, true, true, true] },
                { l: 'Activités', v: [false, true, true, true] },
                { l: 'Forecast', v: [false, true, true, true] },
                { l: 'Rapports avancés', v: [false, true, true, true] },
                { l: 'Rôles personnalisés', v: [false, true, true, true] },
                { l: 'Automatisations', v: [false, 'Base', 'Avancées', 'Avancées'] },
                { l: 'Documents', v: [false, false, true, true] },
                { l: 'Import/Export', v: [false, false, true, true] },
                { l: 'Multi-devise & Mobile Money', v: [false, false, true, true] },
                { l: 'API', v: [false, false, true, 'Complète'] },
                { l: 'Marque blanche', v: [false, false, false, 'Partielle'] },
                { l: 'Support prioritaire + SLA', v: [false, false, false, true] },
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

      <Footer onManageCookies={() => window.__liafrikOpenCookies?.()} />
    </div>
  );
}
