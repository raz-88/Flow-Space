import React, { useState, forwardRef, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, type = 'text', className = '', id, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === 'password';
    const computedType = isPasswordType ? (showPassword ? 'text' : 'password') : type;
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-[#172033] tracking-wide"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={computedType}
            className={`w-full bg-white text-[#172033] text-sm placeholder:text-slate-400 border rounded-xl py-2.5 transition-all duration-200 focus:outline-hidden ${
              icon ? 'pl-10' : 'pl-3.5'
            } ${isPasswordType ? 'pr-11' : 'pr-3.5'} ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 text-rose-950'
                : 'border-[#E7EAF0] focus:border-[#635BFF] focus:ring-4 focus:ring-[#635BFF]/10 hover:border-slate-300 shadow-2xs'
            } ${className}`}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors focus:outline-hidden cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {error ? (
          <p className="text-xs text-rose-600 font-normal">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-[#64748B]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
