import React from 'react';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success text-white border-transparent',
  danger: 'bg-danger-bg text-danger-fg border-danger-fg/20',
  warning: 'bg-warning-bg text-warning-fg border-warning-fg/20',
  info: 'bg-info-bg text-info-fg border-info-fg/20',
  neutral: 'bg-neutral-bg text-neutral-fg border-neutral-fg/20',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};
