import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Globe2, Phone, Mail, Linkedin, Twitter, Facebook } from 'lucide-react';
import { Logo } from '../components/Logo';
import { PLATFORM_NAME, PLATFORM_VENDOR, FAQ_ITEMS, PLANS } from '../lib/constants';
import { formatMoney } from '../lib/utils';

export function Footer({ onManageCookies }: { onManageCookies?: () => void }) {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-gray-500">
              La plateforme CRM SaaS multi-tenant pour conquérir le marché africain. Éditée par {PLATFORM_VENDOR}.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="#" className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:bg-coral-50 hover:text-coral-600"><Linkedin size={16} /></a>
              <a href="#" className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:bg-coral-50 hover:text-coral-600"><Twitter size={16} /></a>
              <a href="#" className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:bg-coral-50 hover:text-coral-600"><Facebook size={16} /></a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Produit</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><Link to="/pricing" className="hover:text-coral-600">Tarifs</Link></li>
              <li><a href="#features" className="hover:text-coral-600">Fonctionnalités</a></li>
              <li><a href="#faq" className="hover:text-coral-600">FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Légal</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-coral-600">CGU</a></li>
              <li><a href="#" className="hover:text-coral-600">Confidentialité</a></li>
              <li><a href="#" className="hover:text-coral-600">Mentions légales</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Contact</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li className="flex items-center gap-2"><Building2 size={14} /> Dubaï · Yaoundé/Soa</li>
              <li className="flex items-center gap-2"><Mail size={14} /> contact@liyha.group</li>
              <li className="flex items-center gap-2"><Phone size={14} /> +971 · +237</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-6 sm:flex-row">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} {PLATFORM_VENDOR}. Tous droits réservés.</p>
          <button onClick={onManageCookies} className="text-xs text-gray-400 hover:text-coral-600">Gérer mes cookies</button>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-coral-600">Fonctionnalités</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-coral-600">Tarifs</a>
            <a href="#faq" className="text-sm font-medium text-gray-600 hover:text-coral-600">FAQ</a>
            <a href="#contact" className="text-sm font-medium text-gray-600 hover:text-coral-600">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary">Connexion</Link>
            <Link to="/signup" className="btn-primary">Essai gratuit</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-mint-50 to-white">
        <div className="absolute inset-0 -z-10 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(251,93,31,0.08), transparent 40%), radial-gradient(circle at 80% 60%, rgba(34,197,94,0.10), transparent 45%)' }} />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-coral-50 px-3 py-1 text-xs font-medium text-coral-700">
                <Globe2 size={14} /> 54 pays africains · Multi-devise · Mobile Money
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                Le CRM qui propulse <span className="text-coral-600">vos ventes en Afrique</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-gray-600">
                {PLATFORM_NAME} centralise votre pipeline, vos contacts, vos rapports — avec isolation multi-tenant stricte, devises panafricaines et Mobile Money. Pensé pour scaler, dès aujourd'hui.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/signup" className="btn-primary text-base px-6 py-3">Commencer gratuitement</Link>
                <Link to="/pricing" className="btn-secondary text-base px-6 py-3">Voir les tarifs</Link>
              </div>
              <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-mint-600" /> 7 jours d'essai</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-mint-600" /> Sans carte</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-mint-600" /> Multi-tenant</span>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-cardHover">
                <div className="grid grid-cols-3 gap-3">
                  {[{ l: 'Pipeline', v: '1,2 M$', c: 'coral' }, { l: 'Won', v: '34', c: 'teal' }, { l: 'Leads', v: '128', c: 'blue' }].map(s => (
                    <div key={s.l} className={`card card-edge ${s.c === 'coral' ? 'border-coral-500' : s.c === 'teal' ? 'border-tealx-500' : 'border-blue-500'} p-3`}>
                      <p className="text-xs text-gray-500">{s.l}</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {['Lead', 'Qualifié', 'Proposition', 'Négociation', 'Won'].map((stage, i) => (
                    <div key={stage} className="rounded-lg bg-gray-50 p-2">
                      <div className="mb-1 h-2 rounded-full bg-coral-400" style={{ opacity: 0.3 + i * 0.15 }} />
                      <p className="text-[10px] text-gray-600">{stage}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {[1,2,3].map(i => <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2"><div className="h-6 w-6 rounded-full bg-mint-100" /><div className="flex-1"><div className="h-2 rounded bg-gray-100" /><div className="mt-1 h-2 w-1/2 rounded bg-gray-50" /></div></div>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900">Tout ce dont votre équipe commerciale a besoin</h2>
          <p className="mt-3 text-gray-600">Des modules complets, activés dès le premier jour, alignés sur les réalités du marché africain.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: 'Pipeline visuel', d: 'Deals par étapes, montants, devises, dates de clôture. Glissez-déposez.' },
            { t: 'Contacts & Companies', d: 'Base unifiée, scopée par tenant, rattachée aux deals et activités.' },
            { t: 'Forecast & Rapports', d: 'Prévisions de revenus, conversion par étape, exports CSV.' },
            { t: 'Automatisations', d: 'Déclencheurs et actions sans code. Rôles personnalisés par module.' },
            { t: 'Multi-devise & Mobile Money', d: 'XOF, XAF, NGN, GHS, KES… Orange, MTN, Wave, M-Pesa selon pays.' },
            { t: 'Isolation multi-tenant', d: 'Row-Level Security. Aucune fuite entre entreprises, même par URL.' },
          ].map(f => (
            <div key={f.t} className="card p-5 hover:shadow-cardHover transition">
              <div className="mb-3 inline-flex rounded-lg bg-mint-50 p-2.5 text-mint-600"><CheckCircle2 size={20} /></div>
              <h3 className="text-base font-semibold text-gray-900">{f.t}</h3>
              <p className="mt-1.5 text-sm text-gray-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-mint-50/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">Des forfaits simples, transparents</h2>
            <p className="mt-3 text-gray-600">7 jours d'essai gratuit sur tous les plans. Sans carte bancaire.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map(plan => (
              <div key={plan.id} className={`card p-6 flex flex-col ${plan.highlight ? 'ring-2 ring-coral-400 border-coral-300' : ''}`}>
                {plan.highlight && <div className="mb-2 inline-flex w-fit rounded-full bg-coral-100 px-2.5 py-0.5 text-xs font-semibold text-coral-700">Le plus populaire</div>}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-2"><span className="text-3xl font-bold text-gray-900">{formatMoney(plan.price, plan.currency)}</span><span className="text-sm text-gray-500">/mois</span></p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-600">
                  {plan.features.map(f => <li key={f} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-mint-600" />{f}</li>)}
                </ul>
                <Link to="/signup" className={`mt-6 ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}>Essayer gratuitement</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900">Ils nous font confiance</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { q: 'Nous avons doublé notre taux de closing en 3 mois.', a: 'Aminata D.', r: 'Directrice commerciale, Abidjan' },
            { q: 'Enfin un CRM qui parle XOF et Mobile Money.', a: 'Kwame O.', r: 'CEO, Accra' },
            { q: 'L\'isolation multi-tenant nous a convaincus.', a: 'Fatima Z.', r: 'COO, Casablanca' },
          ].map((t, i) => (
            <div key={i} className="card p-6">
              <p className="text-sm text-gray-700">"{t.q}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-mint-100 text-mint-700 flex items-center justify-center text-sm font-semibold">{t.a[0]}</div>
                <div><p className="text-sm font-medium text-gray-900">{t.a}</p><p className="text-xs text-gray-500">{t.r}</p></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-mint-50/40 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-gray-900">FAQ</h2>
          <div className="mt-10 space-y-3">
            {FAQ_ITEMS.map(item => (
              <details key={item.q} className="card group p-5">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-gray-900">
                  {item.q}
                  <span className="text-coral-500 group-open:rotate-45 transition">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <Footer onManageCookies={() => window.__liafrikOpenCookies?.()} />
    </div>
  );
}
