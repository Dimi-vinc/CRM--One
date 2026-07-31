import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { Button } from './ui';
import { useLanguage } from '../context/LanguageContext';
import { Link, useLocation } from 'react-router-dom';

type Consent = {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
};

const STORAGE_KEY = 'liafrik_cookie_consent';

const DEFAULT: Consent = { necessary: true, analytics: false, marketing: false, decided: false };

export function loadConsent(): Consent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

function saveConsent(c: Consent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

declare global {
  interface Window { __crmOneOpenCookies?: () => void; }
}

export function CookieBanner() {
  const { t } = useLanguage();
  const loc = useLocation();
  const [consent, setConsent] = useState<Consent>(DEFAULT);
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  // The public/auth pages (Landing, Pricing, Login, Signup, Forgot/Reset password, Onboarding)
  // are branded blue (PayPal-style); the logged-in dashboard keeps its coral/mint identity.
  // The banner appears in both, so it adapts rather than clashing with one or the other.
  const isPublicContext = ['/', '/pricing', '/login', '/signup', '/forgot-password', '/reset-password', '/mfa-challenge', '/onboarding', '/privacy', '/terms', '/cgu', '/about', '/contact']
    .some(p => loc.pathname === p);
  const accentText = isPublicContext ? 'text-blue-700' : 'text-coral-600';
  const accentIconBg = isPublicContext ? 'bg-blue-50 text-blue-600' : 'bg-mint-50 text-mint-600';
  const accentCheckbox = isPublicContext ? 'text-blue-600 focus:ring-blue-400' : 'text-coral-500 focus:ring-coral-400';

  useEffect(() => {
    const c = loadConsent();
    setConsent(c);
    setOpen(!c.decided);
    window.__crmOneOpenCookies = () => { setCustomizing(true); setOpen(true); };
    return () => { delete window.__crmOneOpenCookies; };
  }, []);

  const decide = (c: Omit<Consent, 'decided'>) => {
    const next = { ...c, decided: true };
    saveConsent(next);
    setConsent(next);
    setOpen(false);
    setCustomizing(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-4 shadow-cardHover sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${accentIconBg}`}><Cookie size={20} /></div>
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              {t('cookie.text')}{' '}
              <Link to="/privacy" className={`font-medium hover:underline ${accentText}`}>{t('footer.privacy')}</Link>
            </p>
            {!customizing ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => decide({ necessary: true, analytics: true, marketing: true })}
                  className={isPublicContext ? 'btn-primary-landing text-sm px-4 py-2.5' : 'btn-primary'}
                >
                  {t('cookie.accept')}
                </button>
                <Button size="sm" variant="secondary" onClick={() => decide({ necessary: true, analytics: false, marketing: false })}>{t('cookie.reject')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setCustomizing(true)}>{t('cookie.customize')}</Button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {[
                  { k: 'necessary' as const, l: t('cookie.accept') + ' (obligatoire)', d: 'Auth' },
                  { k: 'analytics' as const, l: 'Analytics', d: 'Audience' },
                  { k: 'marketing' as const, l: 'Marketing', d: 'Ads' },
                ].map(row => (
                  <label key={row.k} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                    <span>
                      <span className="block text-sm font-medium text-gray-800">{row.l}</span>
                      <span className="block text-xs text-gray-500">{row.d}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={consent[row.k]}
                      disabled={row.k === 'necessary'}
                      onChange={(e) => setConsent({ ...consent, [row.k]: e.target.checked })}
                      className={`h-4 w-4 rounded border-gray-300 ${accentCheckbox}`}
                    />
                  </label>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => decide({ necessary: consent.necessary, analytics: consent.analytics, marketing: consent.marketing })}
                    className={isPublicContext ? 'btn-primary-landing text-sm px-4 py-2.5' : 'btn-primary'}
                  >
                    {t('common.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
