import React, { useState, useEffect } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import logoImg from '../../assets/DC.png';

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
    <div className="flex h-screen w-screen bg-obsidian-950 items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-2xl w-full z-10 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-obsidian-900 rounded-2xl mb-6 border border-white/10 shadow-xl">
            <img src={logoImg} alt="Craftora" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Welcome to <span className="text-slate-200">Craftora</span>
          </h1>
          <p className="text-slate-400 text-sm">
            Set up your dedicated workspace folder to get started.
          </p>
        </div>

        <div className="bg-obsidian-900/60 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl">
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <PlaceholderIcon className="w-4 h-4 text-slate-200" />
                Server Files Directory
              </span>
              <span className="text-slate-400 text-xs font-semibold">Must be a strictly empty folder</span>
            </label>
            
            <div className="flex gap-3">
              <div className={`relative flex-1 rounded-xl overflow-hidden transition-all duration-300 border ${
                validationResult?.error || (validationResult && !validationResult.isEmpty)
                  ? 'border-red-500/50 bg-red-500/5 ring-1 ring-red-500/30' 
                  : isDirectoryValid
                    ? 'border-white/10 bg-emerald-500/5 ring-1 ring-emerald-500/30' 
                    : 'border-white/10 bg-obsidian-950/50'
              }`}>
                <input
                  type="text"
                  value={selectedPath}
                  onChange={(e) => {
                    setSelectedPath(e.target.value);
                    validatePath(e.target.value);
                  }}
                  placeholder="Select an empty directory..."
                  className="w-full bg-transparent px-4 py-4 text-slate-200 outline-none font-mono text-sm placeholder:text-slate-600"
                  spellCheck={false}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValidating && <div className="w-5 h-5 border-2 border-white/10 border-t-transparent rounded-full animate-spin" />}
                  {!isValidating && isDirectoryValid && <PlaceholderIcon className="w-5 h-5 text-slate-300 animate-in zoom-in" />}
                  {!isValidating && (validationResult?.error || (validationResult && !validationResult.isEmpty)) && <PlaceholderIcon className="w-5 h-5 text-red-500 animate-in zoom-in" />}
                </div>
              </div>
              <button
                onClick={handleBrowse}
                className="px-6 py-4 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-slate-200 font-medium transition-colors border border-white/5 hover:border-white/10 flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <PlaceholderIcon className="w-5 h-5 text-slate-200" />
                Browse
              </button>
            </div>

            {/* Validation Feedback */}
            <div className={`mt-3 flex items-start gap-2 text-sm transition-all duration-300 ${
              validationResult?.error ? 'text-red-400 opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none h-0'
            }`}>
              <PlaceholderIcon className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{validationResult?.error}</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/5">
            <button
              onClick={handleNextStep}
              disabled={!isDirectoryValid || isValidating}
              className={`flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all duration-300 ${
                isDirectoryValid && !isValidating
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] translate-y-0 cursor-pointer'
                  : 'bg-obsidian-800 text-slate-500 cursor-not-allowed border border-white/5 opacity-60'
              }`}
            >
              Next Step
              <PlaceholderIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
