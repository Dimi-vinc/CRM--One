import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, AlertCircle, LogOut } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function MfaChallenge() {
  const nav = useNavigate();
  const loc = useLocation();
  const { refresh, signOut } = useAuth();
  const { t } = useLanguage();
  const from = (loc.state as { from?: string } | null)?.from || '/dashboard';
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp.find(f => f.status === 'verified');
      if (factor) setFactorId(factor.id);
      setReady(true);
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || code.trim().length < 6) return;
    setError(null);
    setLoading(true);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !challenge) {
      setLoading(false);
      setError(chErr?.message || t('mfa.verifyFailed'));
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setLoading(false);
    if (verifyErr) {
      setError(t('mfa.invalidCode'));
      return;
    }
    await refresh();
    nav(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blue-50/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><Logo size="lg" /></div>
        <div className="mt-8 flex items-center justify-center gap-2">
          <ShieldCheck size={22} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t('mfa.title')}</h1>
        </div>
        <p className="mt-1 text-center text-sm text-gray-500">{t('mfa.subtitle')}</p>

        {ready && !factorId ? (
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{t('mfa.noFactor')}</span>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <input
              autoFocus
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="input text-center text-lg tracking-[0.5em]"
            />
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <Button type="submit" disabled={loading || code.length < 6 || !factorId} className="w-full" size="lg">
              {loading ? t('mfa.verifying') : t('mfa.verify')}
            </Button>
          </form>
        )}

        <button onClick={() => signOut()} className="mt-6 mx-auto flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
          <LogOut size={14} /> {t('mfa.signOut')}
        </button>
      </div>
    </div>
  );
}
