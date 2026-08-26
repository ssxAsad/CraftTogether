import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  return (
    <header className="h-8 bg-obsidian-950 border-b border-white/5 flex items-center justify-end select-none titlebar-drag z-50 shrink-0">
      {/* Windows Window Controls (Minimize, Maximize, Close) */}
      <div className="flex items-center h-full titlebar-no-drag">
        <button
          type="button"
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/10 transition cursor-pointer"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className="w-11 h-full flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/10 transition cursor-pointer"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="w-12 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-[#C6011F] active:bg-red-700 transition cursor-pointer"
          title="Close (Exit Craftora)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
