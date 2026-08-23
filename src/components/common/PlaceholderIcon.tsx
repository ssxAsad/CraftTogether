import React from 'react';

interface PlaceholderIconProps {
  className?: string;
}

export const PlaceholderIcon: React.FC<PlaceholderIconProps> = ({ className = "w-4 h-4" }) => {
  return (
    <div className={`border-2 border-dashed border-slate-500/50 rounded-sm opacity-60 ${className}`} />
  );
};
