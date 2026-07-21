import { Globe2, Check } from 'lucide-react';
import { useLanguage, type Lang } from '../context/LanguageContext';
import { useState, useRef, useEffect } from 'react';

export function LanguageSelector({ light = false }: { light?: boolean }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const langs: { code: Lang; label: string; flag: string }[] = [
    { code: 'fr', label: 'Français', flag: 'FR' },
    { code: 'en', label: 'English', flag: 'EN' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
          light
            ? 'text-white/90 hover:bg-white/10'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
        aria-label="Language selector"
      >
        <Globe2 size={16} />
        <span className="uppercase">{lang}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-40 rounded-xl border border-gray-100 bg-white p-1.5 shadow-cardHover">
          {langs.map(l => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-gray-100 ${
                lang === l.code ? 'font-semibold text-coral-600' : 'text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-7 items-center justify-center rounded bg-gray-100 text-[10px] font-bold text-gray-600">{l.flag}</span>
                {l.label}
              </span>
              {lang === l.code && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
