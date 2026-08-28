import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface ProtectedIpDisplayProps {
  ip: string | undefined | null;
  className?: string;
}

export const ProtectedIpDisplay: React.FC<ProtectedIpDisplayProps> = ({ ip, className = '' }) => {
  const [show, setShow] = useState(false);
  const displayIp = ip || 'Unknown';

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block min-w-[140px] ${className}`}>
        {show ? displayIp : '••••••••••••••••'}
      </span>
      <button
        onClick={() => setShow(!show)}
        className="text-content-secondary hover:text-content-primary transition focus:outline-none"
        title={show ? "Hide IP" : "Show IP"}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
