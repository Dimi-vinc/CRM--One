import { classNames } from '../lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** On dark backgrounds use the white variant */
  light?: boolean;
  className?: string;
}

const SIZES: Record<string, { h: string; icon: string; one: string }> = {
  sm: { h: 'h-7', icon: 'h-6 w-6', one: 'text-[15px]' },
  md: { h: 'h-9', icon: 'h-8 w-8', one: 'text-[19px]' },
  lg: { h: 'h-11', icon: 'h-10 w-10', one: 'text-[24px]' },
};

// Official CRM-One mark: the circular-flow icon (public/logo.png) paired with the wordmark.
export function Logo({ size = 'md', light = false, className }: LogoProps) {
  const s = SIZES[size];
  return (
    <div
      className={classNames(
        'flex items-center gap-2 font-bold leading-none tracking-tight select-none',
        s.h,
        className,
      )}
      aria-label="CRM-One"
    >
      <img src="/logo.png" alt="" className={classNames(s.icon, 'shrink-0')} />
      <span
        className={classNames(
          s.one,
          'font-extrabold',
          light ? 'text-white' : 'text-slate-900',
        )}
        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
      >
        CRM<span className="bg-clip-text text-transparent bg-gradient-to-br from-sky-400 to-blue-600">-One</span>
      </span>
    </div>
  );
}
