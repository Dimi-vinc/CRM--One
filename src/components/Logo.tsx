import { classNames } from '../lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES: Record<string, { h: string; icon: string }> = {
  sm: { h: 'h-7', icon: 'h-7 w-7' },
  md: { h: 'h-9', icon: 'h-9 w-9' },
  lg: { h: 'h-11', icon: 'h-11 w-11' },
};

// Official CRM-One mark: just the icon (public/logo.png) — no wordmark, by request.
export function Logo({ size = 'md', className }: LogoProps) {
  const s = SIZES[size];
  return (
    <div className={classNames('flex items-center', s.h, className)} aria-label="CRM-One">
      <img src="/logo.png" alt="CRM-One" className={classNames(s.icon, 'shrink-0')} />
    </div>
  );
}
