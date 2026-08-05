import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, useEffect } from 'react';
import { X } from 'lucide-react';
import { classNames, initials, type ColorKey, COLOR_RAMPS } from '../lib/utils';

// ---- Button ----
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};
export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger',
  };
  const sizes: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2.5', lg: 'text-base px-5 py-3',
  };
  return (
    <button className={classNames(variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

// ---- Card ----
export function Card({ className, children, edge, onClick }: { className?: string; children?: ReactNode; edge?: ColorKey; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={classNames('card', edge && 'card-edge', edge && COLOR_RAMPS[edge].border, className)}>
      {children}
    </div>
  );
}

// ---- Input / Label / Select / Textarea ----
type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string };
export function Input({ label, hint, error, className, id, ...rest }: InputProps) {
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <input id={id} className={classNames('input', error && 'border-red-400 focus:border-red-400 focus:ring-red-100', className)} {...rest} />
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; hint?: string };
export function Select({ label, hint, className, id, children, ...rest }: SelectProps) {
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <select id={id} className={classNames('input', className)} {...rest}>{children}</select>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };
export function Textarea({ label, className, id, ...rest }: TextareaProps) {
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <textarea id={id} className={classNames('input', className)} {...rest} />
    </div>
  );
}

// ---- Badge ----
export function Badge({ children, color = 'gray', className, title }: { children: ReactNode; color?: ColorKey; className?: string; title?: string }) {
  const c = COLOR_RAMPS[color];
  return <span title={title} className={classNames('badge', c.bg, c.text, className)}>{children}</span>;
}

// ---- Avatar ----
export function Avatar({ name, src, size = 36, color = 'orange' }: { name?: string; src?: string; size?: number; color?: ColorKey }) {
  const c = COLOR_RAMPS[color] || COLOR_RAMPS.orange;
  return src
    ? <img src={src} alt={name || ''} style={{ width: size, height: size }} className="rounded-full object-cover" />
    : (
      <div style={{ width: size, height: size, fontSize: size * 0.4 }} className={classNames('rounded-full flex items-center justify-center font-semibold', c.bg, c.text)}>
        {initials(name)}
      </div>
    );
}

// ---- Modal ----
export function Modal({ open, onClose, title, children, size = 'md' }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  const widths: Record<string, string> = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={classNames('relative w-full bg-white rounded-2xl shadow-xl', widths[size])}>
        {title && (
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
          </div>
        )}
        <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ---- Empty state ----
export function EmptyState({ icon: Icon, title, description, action }: { icon: ComponentType<{ size?: number }>; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 rounded-full bg-mint-50 p-3 text-mint-600"><Icon size={24} /></div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---- Skeleton ----
export function Skeleton({ className }: { className?: string }) {
  return <div className={classNames('animate-pulse rounded bg-gray-100', className)} />;
}

// ---- Page header ----
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
