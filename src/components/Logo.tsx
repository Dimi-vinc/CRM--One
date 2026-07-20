import { classNames } from '../lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** On dark backgrounds use the white variant */
  light?: boolean;
  className?: string;
}

const SIZES: Record<string, { h: string; w: string; main: string; one: string }> = {
  sm: { h: 'h-7', w: 'auto', main: 'text-[15px]', one: 'text-[15px]' },
  md: { h: 'h-9', w: 'auto', main: 'text-[19px]', one: 'text-[19px]' },
  lg: { h: 'h-11', w: 'auto', main: 'text-[24px]', one: 'text-[24px]' },
};

export function Logo({ size = 'md', light = false, className }: LogoProps) {
  const s = SIZES[size];
  return (
    <div
      className={classNames(
        'flex items-center gap-0 font-bold leading-none tracking-tight select-none',
        s.h,
        className,
      )}
      aria-label="LiAfrik One"
    >
      <span
        className={classNames(
          s.main,
          'font-extrabold',
          light ? 'text-white' : 'text-slate-900',
        )}
        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
      >
        LiAfrik
      </span>
      <span
        className={classNames(
          s.one,
          'ml-0.5 font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-sky-400 to-blue-600',
        )}
        style={{ fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}
      >
        One
      </span>
    </div>
  );
}
