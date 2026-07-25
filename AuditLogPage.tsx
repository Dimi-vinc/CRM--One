import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Globe2, Phone, Mail, Linkedin, Twitter, Facebook } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSelector } from '../components/LanguageSelector';
import { PLATFORM_NAME, PLATFORM_VENDOR, FAQ_ITEMS, PLANS } from '../lib/constants';
import { formatMoney } from '../lib/utils';
import { useLanguage } from '../context/LanguageContext';

export function Footer({ onManageCookies }: { onManageCookies?: () => void }) {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-gray-500">
              {t('footer.tagline')} {PLATFORM_VENDOR}.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="#" className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:bg-coral-50 hover:text-coral-600"><Linkedin size={16} /></a>
              <a href="#" className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:bg-coral-50 hover:text-coral-600"><Twitter size={16} /></a>
              <a href="#" className="rounded-lg bg-gray-100 p-2 text-gray-500 hover:bg-coral-50 hover:text-coral-600"><Facebook size={16} /></a>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{t('footer.product')}</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><Link to="/pricing" className="hover:text-coral-600">{t('nav.pricing')}</Link></li>
              <li><a href="#features" className="hover:text-coral-600">{t('nav.features')}</a></li>
              <li><a href="#faq" className="hover:text-coral-600">{t('nav.faq')}</a></li>
              <li><Link to="/about" className="hover:text-coral-600">{t('footer.about')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{t('footer.legal')}</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><Link to="/cgu" className="hover:text-coral-600">{t('footer.cgu')}</Link></li>
              <li><Link to="/privacy" className="hover:text-coral-600">{t('footer.privacy')}</Link></li>
              <li><Link to="/terms" className="hover:text-coral-600">{t('footer.terms')}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">{t('footer.contact')}</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-500">
              <li><Link to="/contact" className="flex items-center gap-2 hover:text-coral-600"><Building2 size={14} /> {t('footer.locations')}</Link></li>
              <li><a href="mailto:contact@liyha.group" className="flex items-center gap-2 hover:text-coral-600"><Mail size={14} /> contact@liyha.group</a></li>
              <li className="flex items-center gap-2"><Phone size={14} /> +971 · +237</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-6 sm:flex-row">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} {PLATFORM_VENDOR}. {t('footer.rights')}</p>
          <button onClick={onManageCookies} className="text-xs text-gray-400 hover:text-coral-600">{t('footer.cookies')}</button>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-coral-600">{t('nav.features')}</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-coral-600">{t('nav.pricing')}</a>
            <a href="#faq" className="text-sm font-medium text-gray-600 hover:text-coral-600">{t('nav.faq')}</a>
            <a href="#contact" className="text-sm font-medium text-gray-600 hover:text-coral-600">{t('nav.contact')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Link to="/login" className="btn-secondary">{t('nav.login')}</Link>
            <Link to="/signup" className="btn-primary">{t('nav.signup')}</Link>
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
                <Globe2 size={14} /> {t('landing.badge')}
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                {t('landing.heroTitle1')} <span className="text-coral-600">{t('landing.heroTitle2')}</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-gray-600">
                {PLATFORM_NAME} {t('landing.heroSubtitle')}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/signup" className="btn-primary text-base px-6 py-3">{t('nav.startFree')}</Link>
                <Link to="/pricing" className="btn-secondary text-base px-6 py-3">{t('nav.seePricing')}</Link>
              </div>
              <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-mint-600" /> {t('landing.trialDays')}</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-mint-600" /> {t('landing.noCard')}</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-mint-600" /> {t('landing.multiTenant')}</span>
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
          <h2 className="text-3xl font-bold text-gray-900">{t('landing.featuresTitle')}</h2>
          <p className="mt-3 text-gray-600">{t('landing.featuresSubtitle')}</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: t('landing.feature1.title'), d: t('landing.feature1.desc') },
            { t: t('landing.feature2.title'), d: t('landing.feature2.desc') },
            { t: t('landing.feature3.title'), d: t('landing.feature3.desc') },
            { t: t('landing.feature4.title'), d: t('landing.feature4.desc') },
            { t: t('landing.feature5.title'), d: t('landing.feature5.desc') },
            { t: t('landing.feature6.title'), d: t('landing.feature6.desc') },
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
            <h2 className="text-3xl font-bold text-gray-900">{t('landing.pricingTitle')}</h2>
            <p className="mt-3 text-gray-600">{t('landing.pricingSubtitle')}</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map(plan => (
              <div key={plan.id} className={`card p-6 flex flex-col ${plan.highlight ? 'ring-2 ring-coral-400 border-coral-300' : ''}`}>
                {plan.highlight && <div className="mb-2 inline-flex w-fit rounded-full bg-coral-100 px-2.5 py-0.5 text-xs font-semibold text-coral-700">{t('common.popular')}</div>}
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-2"><span className="text-3xl font-bold text-gray-900">{formatMoney(plan.price, plan.currency)}</span><span className="text-sm text-gray-500">{t('common.perMonth')}</span></p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-gray-600">
                  {plan.features.map(f => <li key={f} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-mint-600" />{f}</li>)}
                </ul>
                <Link to="/signup" className={`mt-6 ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`}>{t('landing.tryFree')}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-gray-900">{t('landing.testimonialsTitle')}</h2>
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
          <h2 className="text-center text-3xl font-bold text-gray-900">{t('landing.faqTitle')}</h2>
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
