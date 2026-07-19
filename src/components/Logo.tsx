import { Zap } from 'lucide-react';
import { PLATFORM_NAME } from '../lib/constants';
import { classNames } from '../lib/utils';

export function Logo({ size = 'md', light = false }: { size?: 'sm' | 'md' | 'lg'; light?: boolean }) {
  const box = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
  const text = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';
  return (
    <div className="flex items-center gap-2">
      <div className={classNames('rounded-lg bg-gradient-to-br from-coral-400 to-coral-600 flex items-center justify-center text-white shadow-sm', box)}>
        <Zap size={iconSize} fill="currentColor" />
      </div>
      <span className={classNames('font-bold tracking-tight', text, light ? 'text-white' : 'text-gray-900')}>
        {PLATFORM_NAME}
      </span>
    </div>
  );
}
