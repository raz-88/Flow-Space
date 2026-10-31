import React, { type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger_solid';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg font-medium',
    md: 'text-sm px-4 py-2 gap-2 rounded-xl font-medium',
    lg: 'text-base px-5 py-2.5 gap-2.5 rounded-xl font-semibold',
  };

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] hover:from-[#5145E5] hover:to-[#7C3AED] text-white shadow-[0_4px_14px_0_rgba(99,91,255,0.25)] hover:shadow-[0_6px_20px_0_rgba(99,91,255,0.35)] focus:ring-[#635BFF] active:scale-[0.98]',
    secondary:
      'bg-white hover:bg-[#F0EAFE]/30 text-[#172033] hover:text-[#635BFF] border border-[#E7EAF0] hover:border-[#635BFF]/30 shadow-xs hover:shadow-sm focus:ring-[#635BFF]/30 active:scale-[0.98]',
    outline:
      'bg-transparent hover:bg-slate-100/70 text-[#172033] border border-[#E7EAF0] hover:border-slate-300 focus:ring-slate-300 active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-slate-100/80 text-[#64748B] hover:text-[#172033] focus:ring-slate-300 active:scale-[0.98]',
    danger:
      'bg-rose-50 hover:bg-rose-100/80 text-rose-700 border border-rose-200/80 focus:ring-rose-400 active:scale-[0.98]',
    danger_solid:
      'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500 active:scale-[0.98]',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};
