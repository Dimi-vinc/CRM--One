import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSelector } from '../components/LanguageSelector';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import { PLATFORM_NAME } from '../lib/constants';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { t } = useLanguage();
  const { refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInErr) { setError(signInErr.message); return; }
    // RequireAuth / PublicOnly will redirect to /mfa-challenge automatically if 2FA is enabled on this account
    await refresh();
    nav(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-blue-50/30 lg:grid lg:grid-cols-2">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between">
            <Link to="/"><Logo size="lg" /></Link>
            <LanguageSelector />
          </div>
          <h1 className="mt-8 text-2xl font-bold text-gray-900">{t('auth.loginTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('auth.loginSubtitle')} {PLATFORM_NAME}.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
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
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input pl-9" placeholder="••••••••" />
              </div>
              <Link to="/forgot-password" className="mt-1.5 inline-block text-xs font-medium text-blue-700 hover:underline">Mot de passe oublié ?</Link>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? t('common.loading') : t('auth.loginBtn')}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            {t('auth.noAccount')} <Link to="/signup" className="font-medium text-blue-700 hover:underline">{t('auth.createAccount')}</Link>
          </p>
        </div>
      </div>
      <div className="hidden bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 lg:flex lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold text-gray-900">{t('landing.heroTitle1')} <span className="text-blue-700">{t('landing.heroTitle2')}</span></h2>
          <p className="mt-4 text-gray-600">{t('landing.heroSubtitle')}</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[['USD','$'],['EUR','€'],['GBP','£'],['AED','د.إ'],['XOF','FCFA'],['NGN','₦']].map(([c,s]) => (
              <div key={c} className="card p-3 text-center"><p className="text-xs text-gray-500">{c}</p><p className="font-bold text-gray-900">{s}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
