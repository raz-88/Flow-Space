import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={`bg-white border border-[#E7EAF0] rounded-2xl p-5 md:p-6 shadow-[0_1px_3px_0_rgba(23,32,51,0.03),0_1px_2px_-1px_rgba(23,32,51,0.03)] transition-all duration-200 ${
        hoverable ? 'hover:border-[#635BFF]/30 hover:shadow-[0_10px_24px_-4px_rgba(99,91,255,0.08)]' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
