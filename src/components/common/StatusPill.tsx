import React from 'react';

export type StatusVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export interface StatusPillProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
  dotAnimate?: boolean;
}

const dotStyles: Record<StatusVariant, string> = {
  success: 'bg-success-fg',
  danger: 'bg-danger-fg',
  warning: 'bg-warning-fg',
  info: 'bg-info-fg',
  neutral: 'bg-neutral-fg',
};

export const StatusPill: React.FC<StatusPillProps> = ({ status, variant = 'neutral', className = '', dotAnimate = false }) => {
  return (
    <div className={`flex items-center gap-2 text-xs font-semibold text-content-primary ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotStyles[variant]} ${dotAnimate ? 'animate-pulse' : ''}`} />
      <span>{status}</span>
    </div>
  );
};
