import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'indigo' | 'outline' | 'blue' | 'mint' | 'peach' | 'rose';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const variantStyles = {
    neutral: 'bg-slate-100/80 text-[#64748B] border border-[#E7EAF0]',
    indigo: 'bg-[#F0EAFE] text-[#635BFF] border border-[#635BFF]/20',
    blue: 'bg-[#E8F0FF] text-[#2563EB] border border-[#2563EB]/20',
    success: 'bg-[#E2F8EE] text-[#059669] border border-[#059669]/20',
    mint: 'bg-[#E2F8EE] text-[#059669] border border-[#059669]/20',
    warning: 'bg-[#FFF0E5] text-[#D97706] border border-[#D97706]/20',
    peach: 'bg-[#FFF0E5] text-[#D97706] border border-[#D97706]/20',
    rose: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    outline: 'bg-white text-[#172033] border border-[#E7EAF0] shadow-2xs',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
