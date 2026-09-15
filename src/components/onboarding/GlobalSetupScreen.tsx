import React, { useState, useEffect, useRef } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { PlayItIcon, JavaIcon } from '../common/Icons';
import { PlayitSetupScreen } from './PlayitSetupScreen';

interface GlobalSetupScreenProps {
  onSetupComplete: () => void;
}

interface DepItem {
  id: 'java' | 'cloud_relay' | 'papermc' | 'plugins';
  name: string;
  description: string;
  status: 'ready' | 'missing' | 'installing' | 'queued' | 'error';
  progress: number;
  error?: string;
  details?: string;
}

const DEP_META: Record<DepItem['id'], { label: string; desc: string; readyLabel: string }> = {
  java: {
    label: 'Java Runtime',
    desc: 'Required to run the Minecraft server. Downloaded once, used for all servers.',
    readyLabel: 'Installed'
  },
  papermc: {
    label: 'Minecraft Server',
    desc: 'The core Minecraft server software (PaperMC). Saved to your workspace folder.',
    readyLabel: 'Downloaded'
  },
  plugins: {
    label: 'Server Plugins',
    desc: 'Adds cross-play support for mobile & console players, plus skin support for all accounts.',
    readyLabel: 'Downloaded'
  },
  cloud_relay: {
    label: 'PlayIt.gg Tunnel',
    desc: 'Lets friends join your server from anywhere over the internet, with no router setup needed.',
    readyLabel: 'Downloaded'
  }
};

export const GlobalSetupScreen: React.FC<GlobalSetupScreenProps> = ({ onSetupComplete }) => {
  const [wizardStep, setWizardStep] = useState<'dependencies' | 'playit'>('dependencies');

  const [dependencies, setDependencies] = useState<DepItem[]>([
    { id: 'java', name: DEP_META.java.label, description: DEP_META.java.desc, status: 'missing', progress: 0 },
    { id: 'papermc', name: DEP_META.papermc.label, description: DEP_META.papermc.desc, status: 'missing', progress: 0 },
    { id: 'plugins', name: DEP_META.plugins.label, description: DEP_META.plugins.desc, status: 'missing', progress: 0 },
    { id: 'cloud_relay', name: DEP_META.cloud_relay.label, description: DEP_META.cloud_relay.desc, status: 'missing', progress: 0 }
  ]);

  const [isInstallingAll, setIsInstallingAll] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Track last reported progress per item to prevent going backwards (race condition fix)
  const lastProgressRef = useRef<Record<string, number>>({});

  useEffect(() => {
    checkAll();

    let unlisten: (() => void) | undefined;
    if (window.electronAPI?.onSetupDependencyProgress) {
      unlisten = window.electronAPI.onSetupDependencyProgress((data: { id: string; percent: number; message?: string }) => {
        setDependencies((prev) =>
          prev.map((item) => {
            if (item.id === data.id) {
              // Fix: only advance progress, never go backwards (prevents race condition flicker)
              const lastPct = lastProgressRef.current[data.id] ?? 0;
              const newPct = Math.max(lastPct, data.percent);
              lastProgressRef.current[data.id] = newPct;

              return {
                ...item,
                progress: newPct,
                details: data.message || item.details,
                status: newPct >= 100 ? 'ready' : 'installing'
              };
            }
            return item;
          })
        );
      });
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const checkAll = async () => {
    setIsChecking(true);
    if (window.electronAPI?.checkSetupDependencies) {
      try {
        const results = await window.electronAPI.checkSetupDependencies();
        setDependencies(prev => {
          return results.map((res: DepItem) => {
            const existing = prev.find(p => p.id === res.id);
            // Preserve 'queued' or 'installing' state if backend says missing
            if (existing && (existing.status === 'queued' || existing.status === 'installing') && res.status !== 'ready') {
              return { ...res, status: existing.status, details: existing.details, progress: existing.progress };
            }
            return res;
          });
        });

      } catch (e) {
        console.error('Error checking dependencies', e);
      }
    } else {
      // Browser preview fallback
      setTimeout(() => {
        setDependencies([
          { id: 'java', name: DEP_META.java.label, description: DEP_META.java.desc, status: 'missing', progress: 0 },
          { id: 'papermc', name: DEP_META.papermc.label, description: DEP_META.papermc.desc, status: 'missing', progress: 0 },
          { id: 'plugins', name: DEP_META.plugins.label, description: DEP_META.plugins.desc, status: 'missing', progress: 0 },
          { id: 'cloud_relay', name: DEP_META.cloud_relay.label, description: DEP_META.cloud_relay.desc, status: 'missing', progress: 0 }
        ]);
      }, 500);
    }
    setIsChecking(false);
  };

  const handleInstallSingle = async (id: DepItem['id']) => {
    // Reset progress tracker for this item
    lastProgressRef.current[id] = 0;

    setDependencies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'installing', progress: 0, details: 'Starting...' } : item))
    );

    if (window.electronAPI?.installSetupDependency) {
      try {
        const success = await window.electronAPI.installSetupDependency(id);
        if (success) {
          lastProgressRef.current[id] = 100;
          setDependencies((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: 'ready', progress: 100, details: DEP_META[id].readyLabel } : item))
          );
        } else {
          setDependencies((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: 'missing', progress: 0, details: 'Failed — try again' } : item))
          );
        }
      } catch {
        setDependencies((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'error', progress: 0, details: 'PlaceholderIcon error' } : item))
        );
      }
      await checkAll();
    } else {
      // Mock for browser preview
      for (let p = 10; p <= 100; p += 25) {
        await new Promise((r) => setTimeout(r, 200));
        setDependencies((prev) =>
          prev.map((item) => (item.id === id ? { ...item, progress: Math.min(100, p) } : item))
        );
      }
      setDependencies((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'ready', progress: 100 } : item))
      );
    }
  };

  const handleInstallAll = async () => {
    setIsInstallingAll(true);
    const missing = dependencies.filter((d) => d.status !== 'ready');

    // Immediately mark all pending items as queued
    setDependencies((prev) =>
      prev.map((item) =>
        item.status !== 'ready' ? { ...item, status: 'queued', details: 'In queue...' } : item
      )
    );

    for (const dep of missing) {
      await handleInstallSingle(dep.id);
    }
    setIsInstallingAll(false);
    await checkAll();
  };

  const readyCount = dependencies.filter((d) => d.status === 'ready').length;
  const allReady = readyCount === dependencies.length;

  // Step 2: PlayIt.gg Setup
  if (wizardStep === 'playit') {
    return (
      <PlayitSetupScreen
        onBack={() => setWizardStep('dependencies')}
        onComplete={onSetupComplete}
      />
    );
  }

  // Step 1: PlaceholderIcon dependencies
  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto max-h-screen">
      {/* Header */}
      <div className="text-center mb-6 pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-bg border border-border-default text-content-primary text-xs font-bold uppercase tracking-wider mb-3">
          <PlaceholderIcon className="w-3.5 h-3.5" />
          <span>Step 1 of 2 — PlaceholderIcon Required Files</span>
        </div>
        <h2 className="text-3xl font-extrabold text-content-primary mb-2 tracking-tight">
          Get Your Server Ready
        </h2>
        <p className="text-content-secondary text-sm max-w-2xl mx-auto">
          PlaceholderIcon the 4 components Craftora needs to run your server. This only happens once — everything is saved to your workspace for future use.
        </p>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-surface-elevated/80 p-4 rounded-2xl border border-border-default mb-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div>
            <h4 className="text-sm font-bold text-content-primary">
              {allReady ? 'Everything is ready!' : `${4 - readyCount} item${4 - readyCount === 1 ? '' : 's'} left to download`}
            </h4>
            <p className="text-xs text-content-secondary">
              {allReady
                ? 'All components are downloaded and ready to use.'
                : 'Click "PlaceholderIcon All" to get everything at once.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkAll}
            disabled={isChecking}
            className="p-2.5 rounded-xl bg-neutral-bg hover:bg-surface-hover text-content-primary transition cursor-pointer border border-border-subtle"
            title="Refresh"
          >
            <PlaceholderIcon className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
          </button>

          {!allReady && (
            <button
              onClick={handleInstallAll}
              disabled={isInstallingAll || isChecking}
              className="px-5 py-2.5 rounded-xl bg-success hover:bg-success/80 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-lg"
            >
              {isInstallingAll ? (
                <PlaceholderIcon className="w-4 h-4 animate-spin" />
              ) : (
                <PlaceholderIcon className="w-4 h-4" />
              )}
              <span>{isInstallingAll ? 'Downloading...' : 'PlaceholderIcon All'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Dependency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Java */}
        <DepCard
          id="java"
          icon={<JavaIcon className="w-9 h-9" />}
          dep={dependencies.find((d) => d.id === 'java')!}
          meta={DEP_META.java}
          onInstall={() => handleInstallSingle('java')}
          buttonLabel="PlaceholderIcon Java"
        />

        {/* PaperMC */}
        <DepCard
          id="papermc"
          icon={<PlaceholderIcon className="w-8 h-8 text-content-primary" />}
          dep={dependencies.find((d) => d.id === 'papermc')!}
          meta={DEP_META.papermc}
          onInstall={() => handleInstallSingle('papermc')}
          buttonLabel="PlaceholderIcon Server"
        />

        {/* Plugins */}
        <DepCard
          id="plugins"
          icon={<PlaceholderIcon className="w-8 h-8 text-content-primary" />}
          dep={dependencies.find((d) => d.id === 'plugins')!}
          meta={DEP_META.plugins}
          onInstall={() => handleInstallSingle('plugins')}
          buttonLabel="PlaceholderIcon Plugins"
        />

        {/* PlayIt.gg */}
        <DepCard
          id="cloud_relay"
          icon={<PlayItIcon className="w-11 h-11 rounded-xl" />}
          iconPadding="p-1.5"
          dep={dependencies.find((d) => d.id === 'cloud_relay')!}
          meta={DEP_META.cloud_relay}
          onInstall={() => handleInstallSingle('cloud_relay')}
          buttonLabel="PlaceholderIcon Tunnel"
        />
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-end pt-2 border-t border-border-default mt-auto">
        <button
          type="button"
          disabled={!allReady}
          onClick={() => setWizardStep('playit')}
          className={`px-6 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg ${
            allReady 
              ? 'bg-success hover:bg-success/80 text-white cursor-pointer' 
              : 'bg-neutral-bg text-content-secondary cursor-not-allowed'
          }`}
        >
          <span>Continue</span>
          <PlaceholderIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─── Reusable Dependency Card ───────────────────────────────────────────────

interface DepCardProps {
  id: DepItem['id'];
  icon: React.ReactNode;
  iconPadding?: string;
  dep: DepItem;
  meta: { label: string; desc: string; readyLabel: string };
  onInstall: () => void;
  buttonLabel: string;
}

const DepCard: React.FC<DepCardProps> = ({ icon, iconPadding = 'p-2.5', dep, meta, onInstall, buttonLabel }) => {
  return (
    <div className="bg-surface-elevated border border-border-default rounded-xl p-5 flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-start justify-between mb-3">
          {icon}

          {dep.status === 'ready' ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-content-primary bg-surface-base px-2.5 py-1 rounded border border-border-default">
              <PlaceholderIcon className="w-3.5 h-3.5" />
              {meta.readyLabel}
            </span>
          ) : dep.status === 'installing' ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-content-primary bg-neutral-bg px-2.5 py-1 rounded border border-border-default">
              <PlaceholderIcon className="w-3.5 h-3.5 animate-spin text-content-primary" />
              Downloading
            </span>
          ) : dep.status === 'queued' ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-warning-fg bg-warning/10 px-2.5 py-1 rounded border border-warning-fg/30">
              <PlaceholderIcon className="w-3.5 h-3.5" />
              In Queue
            </span>
          ) : dep.status === 'error' ? (
            <span className="text-[11px] font-semibold text-danger-fg bg-danger/10 px-2.5 py-1 rounded border border-danger-fg/30">
              Failed
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-content-secondary bg-neutral-bg px-2.5 py-1 rounded">
              Not Downloaded
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-content-primary">{meta.label}</h3>
        <p className="text-xs text-content-secondary mt-1 leading-relaxed">{meta.desc}</p>

        {dep.details && dep.status !== 'ready' && dep.status !== 'missing' && dep.status !== 'queued' && (
          <p className="text-[11px] text-content-muted mt-1">{dep.details}</p>
        )}
      </div>

      {dep.status === 'installing' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-content-secondary">
            <span>{dep.details || 'Downloading...'}</span>
            <span>{dep.progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-surface-base rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${dep.progress}%` }}
            />
          </div>
        </div>
      )}

      {dep.status === 'queued' && (
        <div className="h-1.5 w-full bg-surface-base rounded-full overflow-hidden">
          <div className="h-full bg-warning/40 rounded-full w-full animate-pulse" />
        </div>
      )}

      {/* Only show download button for truly idle/errored items, NOT queued ones */}
      {(dep.status === 'missing' || dep.status === 'error') && (
        <button
          onClick={onInstall}
          className="w-full py-2 rounded-lg bg-success hover:bg-success/80 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <PlaceholderIcon className="w-4 h-4" />
          <span>{buttonLabel}</span>
        </button>
      )}
    </div>
  );
};
