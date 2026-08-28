import React from 'react';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-surface-card border border-border-subtle rounded-lg hover:border-success/30 hover:bg-surface-hover transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
