import { Link } from 'react-router-dom';
import { Building2, Mail, Phone, MapPin } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useLanguage } from '../context/LanguageContext';
import { PLATFORM_NAME, PLATFORM_VENDOR } from '../lib/constants';

export function LegalPage({ type }: { type: 'privacy' | 'terms' | 'cgu' | 'about' | 'contact' }) {
  const { t } = useLanguage();

  const content: Record<string, { title: string; body: React.ReactNode }> = {
    privacy: {
      title: t('footer.privacy'),
      body: (
        <>
          <p className="text-gray-600">{PLATFORM_NAME} is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your data.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">1. Data Collection</h3>
          <p className="mt-2 text-gray-600">We collect account information (name, email, company name), CRM data you enter (contacts, deals, activities), and usage analytics. All data is scoped to your tenant via Row-Level Security.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">2. Data Isolation</h3>
          <p className="mt-2 text-gray-600">Each tenant's data is strictly isolated at the database level. No tenant can access another tenant's data, even by URL manipulation.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">3. Data Retention</h3>
          <p className="mt-2 text-gray-600">Your data is retained for as long as your account is active. Upon account termination, we provide a 30-day export window before permanent deletion.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">4. Third-Party Services</h3>
          <p className="mt-2 text-gray-600">We use Supabase for database and authentication, and Stripe for payment processing. These providers comply with GDPR and industry security standards.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">5. Your Rights</h3>
          <p className="mt-2 text-gray-600">You may request data export, correction, or deletion at any time by contacting <a href="mailto:cs@liafrik.com" className="text-blue-700 hover:underline">cs@liafrik.com</a>.</p>
        </>
      ),
    },
    terms: {
      title: t('footer.terms'),
      body: (
        <>
          <p className="text-gray-600">{PLATFORM_VENDOR} — Société de droit émirati, opérant depuis Dubaï et Yaoundé/Soa.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Éditeur</h3>
          <p className="mt-2 text-gray-600">{PLATFORM_VENDOR} — Dubaï, Émirats Arabes Unis · Yaoundé/Soa, Cameroun.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Directeur de publication</h3>
          <p className="mt-2 text-gray-600">Le représentant légal de {PLATFORM_VENDOR}.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Hébergement</h3>
          <p className="mt-2 text-gray-600">Supabase Inc. — Infrastructure cloud sécurisée. Stripe Inc. — Traitement des paiements.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Propriété intellectuelle</h3>
          <p className="mt-2 text-gray-600">La plateforme {PLATFORM_NAME}, son code, son design et sa marque sont la propriété exclusive de {PLATFORM_VENDOR}. Toute reproduction est interdite sans autorisation.</p>
        </>
      ),
    },
    cgu: {
      title: t('footer.cgu'),
      body: (
        <>
          <h3 className="text-lg font-semibold text-gray-900">1. Acceptance</h3>
          <p className="mt-2 text-gray-600">By creating an account on {PLATFORM_NAME}, you agree to these Terms of Use. If you do not agree, you must not use the platform.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">2. Subscription & Trial</h3>
          <p className="mt-2 text-gray-600">Each new account receives a 7-day free trial with no credit card required. After the trial, a paid subscription is required to maintain access. Plans and pricing are listed on the Pricing page.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">3. Multi-Tenant Isolation</h3>
          <p className="mt-2 text-gray-600">Each company account (tenant) is strictly isolated. You may not attempt to access data belonging to other tenants. Violations result in immediate account suspension.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">4. Acceptable Use</h3>
          <p className="mt-2 text-gray-600">You agree not to use the platform for illegal activities, spam, or to store data that violates applicable laws. {PLATFORM_VENDOR} reserves the right to suspend accounts that violate these terms.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">5. Liability</h3>
          <p className="mt-2 text-gray-600">{PLATFORM_VENDOR} provides the platform "as is." We are not liable for data loss caused by user negligence, force majeure, or third-party service failures. We commit to best-effort availability and security.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">6. Termination</h3>
          <p className="mt-2 text-gray-600">You may cancel your subscription at any time. Upon cancellation, your data is retained for 30 days for export, then permanently deleted.</p>
        </>
      ),
    },
    about: {
      title: t('footer.about'),
      body: (
        <>
          <p className="text-gray-600">{PLATFORM_NAME} is an international multi-tenant SaaS CRM platform. Built by {PLATFORM_VENDOR}, it combines modern CRM capabilities with global business realities: multi-currency support, Mobile Money integration where it matters, and strict data isolation.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Our Mission</h3>
          <p className="mt-2 text-gray-600">To empower African businesses with enterprise-grade sales tools, accessible from any device, in the currencies and languages of the continent.</p>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Key Differentiators</h3>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-gray-600">
            <li>54 African countries with local currencies and Mobile Money providers</li>
            <li>Strict multi-tenant isolation via Row-Level Security</li>
            <li>Bilingual interface (French / English)</li>
            <li>Pipeline, invoicing, communication, and support in one platform</li>
          </ul>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">{PLATFORM_VENDOR}</h3>
          <p className="mt-2 text-gray-600">{PLATFORM_VENDOR} operates from Dubai and Yaoundé/Soa, serving clients across Africa and the diaspora.</p>
        </>
      ),
    },
    contact: {
      title: t('footer.contact'),
      body: (
        <>
          <div className="space-y-4">
            <div className="flex items-start gap-3"><Building2 size={20} className="mt-0.5 text-blue-600" /><div><p className="font-medium text-gray-900">{PLATFORM_VENDOR}</p><p className="text-gray-600">Dubaï, Émirats Arabes Unis · Yaoundé/Soa, Cameroun</p></div></div>
            <div className="flex items-start gap-3"><Mail size={20} className="mt-0.5 text-blue-600" /><div><p className="font-medium text-gray-900">Support</p><a href="mailto:support@liafrik.com" className="text-blue-700 hover:underline">support@liafrik.com</a></div></div>
            <div className="flex items-start gap-3"><Mail size={20} className="mt-0.5 text-blue-600" /><div><p className="font-medium text-gray-900">Service client</p><a href="mailto:cs@liafrik.com" className="text-blue-700 hover:underline">cs@liafrik.com</a></div></div>
            <div className="flex items-start gap-3"><Phone size={20} className="mt-0.5 text-blue-600" /><div><p className="font-medium text-gray-900">Phone</p><p className="text-gray-600">+971 · +237</p></div></div>
            <div className="flex items-start gap-3"><MapPin size={20} className="mt-0.5 text-blue-600" /><div><p className="font-medium text-gray-900">Offices</p><p className="text-gray-600">Dubaï · Yaoundé/Soa</p></div></div>
          </div>
        </>
      ),
    },
  };

  const c = content[type];
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/"><Logo /></Link>
          <Link to="/" className="text-sm font-medium text-gray-600 hover:text-blue-700">← {t('nav.features') === 'Features' ? 'Home' : 'Accueil'}</Link>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">{c.title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed">{c.body}</div>
      </div>
    </div>
  );
}
