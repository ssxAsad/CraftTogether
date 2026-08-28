import React, { createContext, useContext, useState } from 'react';
import { PlaceholderIcon } from '../components/common/PlaceholderIcon';

export type DialogType = 'alert' | 'confirm' | 'prompt' | 'warning' | 'success';

interface DialogOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
  defaultValue?: string;
}

interface DialogContextType {
  showAlert: (title: string, message: string, type?: DialogType) => Promise<void>;
  showConfirm: (title: string, message: string, options?: Partial<DialogOptions>) => Promise<boolean>;
  showPrompt: (title: string, message: string, defaultValue?: string, placeholder?: string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({ title: '', message: '', type: 'alert' });
  const [promptValue, setPromptValue] = useState('');
  const [resolver, setResolver] = useState<{
    resolve: (val: any) => void;
  } | null>(null);

  const showAlert = (title: string, message: string, type: DialogType = 'alert'): Promise<void> => {
    return new Promise((resolve) => {
      setOptions({ title, message, type, confirmText: 'Got It' });
      setResolver({ resolve });
      setIsOpen(true);
    });
  };

  const showConfirm = (title: string, message: string, opt?: Partial<DialogOptions>): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions({
        title,
        message,
        type: opt?.type || 'confirm',
        confirmText: opt?.confirmText || 'Confirm',
        cancelText: opt?.cancelText || 'Cancel'
      });
      setResolver({ resolve });
      setIsOpen(true);
    });
  };

  const showPrompt = (
    title: string,
    message: string,
    defaultValue: string = '',
    placeholder: string = ''
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptValue(defaultValue);
      setOptions({
        title,
        message,
        type: 'prompt',
        defaultValue,
        placeholder,
        confirmText: 'Submit',
        cancelText: 'Cancel'
      });
      setResolver({ resolve });
      setIsOpen(true);
    });
  };

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolver) {
      if (options.type === 'prompt') {
        resolver.resolve(promptValue);
      } else if (options.type === 'confirm' || options.type === 'warning') {
        resolver.resolve(true);
      } else {
        resolver.resolve(undefined);
      }
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (resolver) {
      if (options.type === 'prompt') {
        resolver.resolve(null);
      } else {
        resolver.resolve(false);
      }
    }
  };

  const renderIcon = () => {
    switch (options.type) {
      case 'warning':
        return <PlaceholderIcon className="w-5 h-5 text-danger-fg" />;
      case 'success':
        return <PlaceholderIcon className="w-5 h-5 text-success-fg" />;
      case 'prompt':
        return <PlaceholderIcon className="w-5 h-5 text-content-primary" />;
      case 'confirm':
        return <PlaceholderIcon className="w-5 h-5 text-content-primary" />;
      default:
        return <PlaceholderIcon className="w-5 h-5 text-content-primary" />;
    }
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}

      {/* Craftora Themed Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
          <div className="bg-surface-elevated w-full max-w-md rounded-xl border border-border-subtle shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className={`p-2 rounded-lg shrink-0 border ${
                options.type === 'warning'
                  ? 'bg-danger/10 border-danger/20'
                  : 'bg-neutral-bg border-border-default'
              }`}>
                {renderIcon()}
              </div>

              <div className="space-y-1 flex-1">
                <h3 className="text-sm font-bold text-content-primary">{options.title}</h3>
                <p className="text-xs text-content-secondary leading-relaxed">{options.message}</p>
              </div>

              <button
                onClick={handleCancel}
                className="text-content-secondary hover:text-content-primary p-1 rounded-lg hover:bg-surface-hover transition"
              >
                <PlaceholderIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Prompt input if type === 'prompt' */}
            {options.type === 'prompt' && (
              <input
                type="text"
                autoFocus
                value={promptValue}
                placeholder={options.placeholder}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                  if (e.key === 'Escape') handleCancel();
                }}
                className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary focus:outline-none focus:border-border-default"
              />
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              {(options.type === 'confirm' || options.type === 'prompt' || options.type === 'warning') && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-content-primary rounded-lg text-xs font-semibold border border-border-default transition"
                >
                  {options.cancelText || 'Cancel'}
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 font-bold text-xs rounded-lg transition ${
                  options.type === 'warning' 
                    ? 'bg-danger hover:bg-danger/80 text-surface-base' 
                    : 'bg-success hover:bg-success/80 text-surface-base'
                }`}
              >
                {options.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
