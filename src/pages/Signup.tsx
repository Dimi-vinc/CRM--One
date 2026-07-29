import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, Building2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSelector } from '../components/LanguageSelector';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

export function Signup() {
  const { t } = useLanguage();
  const nav = useNavigate();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, company_name: companyName } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.user) {
      nav('/onboarding', { replace: true, state: { companyName, fullName } });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-mint-50/30 lg:grid lg:grid-cols-2">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between">
            <Link to="/"><Logo size="lg" /></Link>
            <LanguageSelector />
          </div>
          <h1 className="mt-8 text-2xl font-bold text-gray-900">{t('auth.signupTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.signupSubtitle')}.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label">{t('auth.fullName')}</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input required value={fullName} onChange={e => setFullName(e.target.value)} className="input pl-9" placeholder="Aminata Diallo" />
              </div>
            </div>
            <div>
              <label className="label">{t('auth.companyName')}</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input required value={companyName} onChange={e => setCompanyName(e.target.value)} className="input pl-9" placeholder="Acme SARL" />
              </div>
            </div>
            <div>
              <label className="label">{t('auth.email')}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input pl-9" placeholder="vous@entreprise.com" />
              </div>
            </div>
            <div>
              <label className="label">{t('auth.password')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} className="input pl-9" placeholder="6 min." />
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? t('common.loading') : t('auth.signupBtn')}
            </Button>
            <p className="text-center text-xs text-gray-400">
              {t('auth.or')} <Link to="/cgu" className="hover:text-coral-600">{t('footer.cgu')}</Link> · <Link to="/privacy" className="hover:text-coral-600">{t('footer.privacy')}</Link>
            </p>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            {t('auth.haveAccount')} <Link to="/login" className="font-medium text-coral-600 hover:underline">{t('auth.signin')}</Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-gradient-to-br from-coral-50 via-mint-50 to-mint-100 lg:flex lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold text-gray-900">{t('landing.heroTitle1')} <span className="text-coral-600">{t('landing.heroTitle2')}</span></h2>
          <ul className="mt-6 space-y-3 text-gray-700">
            {[
              t('landing.feature1.title'),
              t('landing.feature5.title'),
              t('landing.feature6.title'),
              t('landing.feature3.title'),
            ].map(item => (
              <li key={item} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-coral-500" />{item}</li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-gray-500">LiAfrik — Dubaï & Yaoundé — {t('footer.locations')}</p>
        </div>
      </div>
    </div>
  );
}
