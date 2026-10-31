import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export interface AlertProps {
  type?: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className = '',
}) => {
  const styles = {
    error: {
      bg: 'bg-rose-50/90 border-rose-200/90 text-rose-900',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
      titleColor: 'text-rose-950',
      descColor: 'text-rose-800',
    },
    success: {
      bg: 'bg-[#E2F8EE] border-[#059669]/25 text-[#065F46]',
      icon: <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />,
      titleColor: 'text-[#064E3B]',
      descColor: 'text-[#065F46]',
    },
    warning: {
      bg: 'bg-[#FFF0E5] border-[#D97706]/25 text-[#92400E]',
      icon: <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />,
      titleColor: 'text-[#78350F]',
      descColor: 'text-[#92400E]',
    },
    info: {
      bg: 'bg-[#E8F0FF] border-[#635BFF]/25 text-[#3730A3]',
      icon: <Info className="w-4 h-4 text-[#635BFF] shrink-0 mt-0.5" />,
      titleColor: 'text-[#312E81]',
      descColor: 'text-[#3730A3]',
    },
  };

  const current = styles[type];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-xl border ${current.bg} ${className} transition-all duration-150 animate-in fade-in`}
    >
      {current.icon}
      <div className="flex-1 min-w-0">
        {title && <h4 className={`text-xs font-semibold ${current.titleColor}`}>{title}</h4>}
        <p className={`text-xs ${current.descColor} ${title ? 'mt-0.5' : ''} leading-relaxed`}>
          {message}
        </p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
          aria-label="Dismiss message"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
