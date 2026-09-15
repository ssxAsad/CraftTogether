import React, { useState, useEffect } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import logoImg from '../../assets/craftora.png';

import { GlobalSetupScreen } from './GlobalSetupScreen';

interface FirstLaunchScreenProps {
  onComplete: (directory: string) => void;
}

export const FirstLaunchScreen: React.FC<FirstLaunchScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPath, setSelectedPath] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    isEmpty: boolean;
    error?: string;
  } | null>(null);

  // Default suggested directory
  useEffect(() => {
    const defaultPath = 'C:\\CraftoraServers';
    setSelectedPath(defaultPath);
    validatePath(defaultPath);
  }, []);

  const validatePath = async (targetPath: string) => {
    if (!targetPath || !targetPath.trim()) {
      setValidationResult({ isValid: false, isEmpty: false, error: 'Please specify a folder path.' });
      return;
    }

    setIsValidating(true);
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.validateDirectory(targetPath.trim());
        setValidationResult(result);
      } catch (err: any) {
        setValidationResult({ isValid: false, isEmpty: false, error: err.message || 'Validation error' });
      }
    } else {
      // Browser preview fallback
      if (targetPath.toLowerCase().includes('occupied') || targetPath.toLowerCase().includes('desktop') || targetPath.toLowerCase().includes('files')) {
        setValidationResult({
          isValid: false,
          isEmpty: false,
          error: 'The selected folder is not empty. Please select or create an empty folder to continue.'
        });
      } else {
        setValidationResult({ isValid: true, isEmpty: true });
      }
    }
    setIsValidating(false);
  };

  const handleBrowse = async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.browseDirectory();
        if (result && result.path) {
          setSelectedPath(result.path);
          setValidationResult(result.validation);
        }
      } catch (err: any) {
        setValidationResult({ isValid: false, isEmpty: false, error: 'Failed to open directory browser' });
      }
    } else {
      // Dummy behavior for browser
      const dummyPath = 'C:\\EmptyCraftoraDirectory';
      setSelectedPath(dummyPath);
      validatePath(dummyPath);
    }
  };

  const isDirectoryValid = Boolean(validationResult?.isValid && validationResult?.isEmpty && !validationResult?.error);

  const handleNextStep = async () => {
    if (!isDirectoryValid || isValidating) return;

    if (window.electronAPI) {
      try {
        await window.electronAPI.setStorageDirectory(selectedPath);
        setStep(2);
      } catch (err: any) {
        setValidationResult({ isValid: false, isEmpty: false, error: err.message || 'Failed to set directory' });
      }
    } else {
      setStep(2);
    }
  };

  if (step === 2) {
    return <GlobalSetupScreen onSetupComplete={() => onComplete(selectedPath)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-surface-base items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-2xl w-full z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-surface-elevated rounded-2xl mb-6 border border-border-default shadow-xl">
            <img src={logoImg} alt="Craftora" className="w-16 h-16 object-contain drop-shadow-md" style={{ imageRendering: 'high-quality', WebkitUserDrag: 'none' } as any} />
          </div>
          <h1 className="text-4xl font-bold text-content-primary mb-2 tracking-tight">
            Welcome to <span className="text-content-primary">Craftora</span>
          </h1>
          <p className="text-content-secondary text-sm">
            Set up your dedicated workspace folder to get started.
          </p>
        </div>

        <div className="bg-surface-elevated/80 backdrop-blur-2xl rounded-3xl p-8 border border-border-default shadow-2xl">
          <div className="mb-8">
            <label className="block text-sm font-medium text-content-primary mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PlaceholderIcon className="w-4 h-4 text-content-primary" />
                Server Files Directory
              </span>
              <span className="text-content-secondary text-xs font-semibold">Must be a strictly empty folder</span>
            </label>
            
            <div className="flex gap-3">
              <div className={`relative flex-1 rounded-xl overflow-hidden transition-all duration-300 border ${
                validationResult?.error || (validationResult && !validationResult.isEmpty)
                  ? 'border-danger-fg/50 bg-danger/5 ring-1 ring-danger-fg/30' 
                  : isDirectoryValid
                    ? 'border-border-default bg-success/5 ring-1 ring-success-fg/30' 
                    : 'border-border-default bg-surface-base/50'
              }`}>
                <input
                  type="text"
                  value={selectedPath}
                  onChange={(e) => {
                    setSelectedPath(e.target.value);
                    validatePath(e.target.value);
                  }}
                  placeholder="Select an empty directory..."
                  className="w-full bg-transparent px-4 py-4 text-content-primary outline-none font-mono text-sm placeholder:text-content-muted"
                  spellCheck={false}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidating && <div className="w-5 h-5 border-2 border-border-default border-t-transparent rounded-full animate-spin" />}
                  {!isValidating && isDirectoryValid && <PlaceholderIcon className="w-5 h-5 text-content-primary animate-in zoom-in" />}
                  {!isValidating && (validationResult?.error || (validationResult && !validationResult.isEmpty)) && <PlaceholderIcon className="w-5 h-5 text-danger-fg animate-in zoom-in" />}
                </div>
              </div>
              <button
                onClick={handleBrowse}
                className="px-6 py-4 rounded-xl bg-surface-card hover:bg-surface-hover text-content-primary font-medium transition-colors border border-border-subtle hover:border-border-default flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <PlaceholderIcon className="w-5 h-5 text-content-primary" />
                Browse
              </button>
            </div>
          </div>

          {validationResult?.error && (
            <div className="mb-8 animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 text-danger-fg text-sm flex items-start gap-3">
                <PlaceholderIcon className="w-5 h-5 text-danger-fg shrink-0 mt-0.5" />
                <p className="leading-relaxed">{validationResult.error}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleNextStep}
              disabled={!isDirectoryValid || isValidating}
              className={`px-8 py-4 rounded-xl font-bold text-sm flex items-center gap-3 transition-all duration-300 ${
                isDirectoryValid && !isValidating
                  ? 'bg-success hover:bg-success/80 text-white shadow-lg shadow-success/20 translate-y-0 hover:-translate-y-0.5'
                  : 'bg-surface-card text-content-muted cursor-not-allowed opacity-50'
              }`}
            >
              Continue Setup
              <PlaceholderIcon className={`w-5 h-5 ${isDirectoryValid && !isValidating ? 'text-white animate-pulse' : 'text-content-muted'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
