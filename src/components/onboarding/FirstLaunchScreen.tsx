import React, { useState, useEffect } from 'react';
import logoImg from '../../assets/craftora.png';

import { GlobalSetupScreen } from './GlobalSetupScreen';

interface FirstLaunchScreenProps {
  onComplete: (directory: string) => void;
  initialStep?: 'directory' | 'dependencies' | 'playit';
  initialDirectory?: string;
}

export const FirstLaunchScreen: React.FC<FirstLaunchScreenProps> = ({
  onComplete,
  initialStep = 'directory',
  initialDirectory = ''
}) => {
  const [step, setStep] = useState<1 | 2>(initialStep === 'dependencies' || initialStep === 'playit' ? 2 : 1);
  const [selectedPath, setSelectedPath] = useState(initialDirectory || 'C:\\CraftoraServers');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    isEmpty: boolean;
    error?: string;
  } | null>(null);

  // Default suggested directory or initial directory
  useEffect(() => {
    if (initialDirectory) {
      setSelectedPath(initialDirectory);
    } else {
      const defaultPath = 'C:\\CraftoraServers';
      setSelectedPath(defaultPath);
      validatePath(defaultPath);
    }
  }, [initialDirectory]);

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
        if (window.electronAPI.setSetupStep) {
          await window.electronAPI.setSetupStep('dependencies');
        }
        setStep(2);
      } catch (err: any) {
        setValidationResult({ isValid: false, isEmpty: false, error: err.message || 'Failed to set directory' });
      }
    } else {
      setStep(2);
    }
  };

  if (step === 2) {
    return (
      <GlobalSetupScreen
        onSetupComplete={() => onComplete(selectedPath)}
        initialWizardStep={initialStep === 'playit' ? 'playit' : 'dependencies'}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-surface-base items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-2xl w-full z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
        <div className="text-center mb-10">
          <img
            src={logoImg}
            alt="Craftora"
            className="w-20 h-20 mx-auto object-contain mb-6 drop-shadow-md"
            style={{ imageRendering: 'high-quality', WebkitUserDrag: 'none' } as any}
          />
          <h1 className="text-4xl font-bold text-black mb-2 tracking-tight">
            Welcome to <span className="text-black">Craftora</span>
          </h1>
          <p className="text-content-secondary text-sm">
            Set up your dedicated workspace folder to get started.
          </p>
        </div>

        <div className="bg-surface-elevated/80 backdrop-blur-2xl rounded-3xl p-8 border border-border-default shadow-2xl">
          <div className="mb-8">
            <label className="block text-sm font-semibold text-black mb-2 flex items-center justify-between">
              <span className="text-black font-semibold">
                Server Files Directory
              </span>
              <span className="text-content-secondary text-xs font-semibold">Must be a strictly empty folder</span>
            </label>
            
            <div className="flex gap-3">
              <div className={`relative flex-1 rounded-xl overflow-hidden transition-all duration-300 border ${
                validationResult?.error || (validationResult && !validationResult.isEmpty)
                  ? 'border-warning-fg/50 bg-warning-bg ring-1 ring-warning-fg/30' 
                  : isDirectoryValid
                    ? 'border-success/60 bg-success/10 ring-2 ring-success/20' 
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
                  className="w-full bg-transparent px-4 py-4 text-black outline-none font-mono text-sm placeholder:text-content-muted"
                  spellCheck={false}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidating && <div className="w-5 h-5 border-2 border-border-default border-t-transparent rounded-full animate-spin" />}
                </div>
              </div>
              <button
                onClick={handleBrowse}
                className="px-6 py-4 rounded-xl bg-success hover:bg-success/90 text-white font-bold transition-all shadow-md shadow-success/30 flex items-center justify-center active:scale-95 cursor-pointer shrink-0 border border-success/40"
              >
                Browse
              </button>
            </div>
          </div>

          {validationResult?.error && (
            <div className="mb-8 animate-in slide-in-from-top-2 fade-in duration-300">
              <div className="bg-warning-bg border border-warning-fg/30 rounded-xl p-4 text-warning-fg text-sm flex items-start gap-3">
                <p className="leading-relaxed font-medium">{validationResult.error}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleNextStep}
              disabled={!isDirectoryValid || isValidating}
              className={`px-8 py-4 rounded-xl font-bold text-sm tracking-wide flex items-center gap-3 transition-all duration-300 ${
                isDirectoryValid && !isValidating
                  ? 'bg-success hover:bg-success/90 text-white shadow-lg shadow-success/30 translate-y-0 hover:-translate-y-0.5 active:scale-95 cursor-pointer border border-success/40'
                  : 'bg-surface-card text-content-muted cursor-not-allowed opacity-50 border border-border-subtle'
              }`}
            >
              Continue Setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
