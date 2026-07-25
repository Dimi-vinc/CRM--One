import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { Button } from './ui';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';

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
  interface Window { __liafrikOpenCookies?: () => void; }
}

export function CookieBanner() {
  const { t } = useLanguage();
  const [consent, setConsent] = useState<Consent>(DEFAULT);
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    const c = loadConsent();
    setConsent(c);
    setOpen(!c.decided);
    window.__liafrikOpenCookies = () => { setCustomizing(true); setOpen(true); };
    return () => { delete window.__liafrikOpenCookies; };
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
          <div className="rounded-full bg-mint-50 p-2 text-mint-600"><Cookie size={20} /></div>
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              {t('cookie.text')}{' '}
              <Link to="/privacy" className="font-medium text-coral-600 hover:underline">{t('footer.privacy')}</Link>
            </p>
            {!customizing ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => decide({ necessary: true, analytics: true, marketing: true })}>{t('cookie.accept')}</Button>
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
                      className="h-4 w-4 rounded border-gray-300 text-coral-500 focus:ring-coral-400"
                    />
                  </label>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" onClick={() => decide({ necessary: consent.necessary, analytics: consent.analytics, marketing: consent.marketing })}>
                    {t('common.save')}
                  </Button>
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
