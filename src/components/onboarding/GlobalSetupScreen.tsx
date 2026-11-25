import React, { useState, useEffect, useRef } from 'react';
import { PlayItIcon, JavaIcon } from '../common/Icons';
import { PlayitSetupScreen } from './PlayitSetupScreen';

interface GlobalSetupScreenProps {
  onSetupComplete: () => void;
  initialWizardStep?: 'dependencies' | 'playit';
}

interface DepItem {
  id: 'java' | 'cloud_relay';
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
  cloud_relay: {
    label: 'PlayIt.gg Tunnel',
    desc: 'Lets friends join your server from anywhere over the internet, with no router setup needed.',
    readyLabel: 'Downloaded'
  }
};

export const GlobalSetupScreen: React.FC<GlobalSetupScreenProps> = ({ onSetupComplete, initialWizardStep = 'dependencies' }) => {
  const [wizardStep, setWizardStep] = useState<'dependencies' | 'playit'>(initialWizardStep);

  const [dependencies, setDependencies] = useState<DepItem[]>([
    { id: 'java', name: DEP_META.java.label, description: DEP_META.java.desc, status: 'missing', progress: 0 },
    { id: 'cloud_relay', name: DEP_META.cloud_relay.label, description: DEP_META.cloud_relay.desc, status: 'missing', progress: 0 }
  ]);

  const [isInstallingAll, setIsInstallingAll] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Track last reported progress, messages, active installs, and readiness for focus-recheck
  const lastProgressRef = useRef<Record<string, number>>({});
  const lastMessageRef = useRef<Record<string, string>>({});
  const installingIdsRef = useRef<Set<string>>(new Set());
  const wizardStepRef = useRef(wizardStep);
  const allReadyRef = useRef(false);

  wizardStepRef.current = wizardStep;
  allReadyRef.current = dependencies.every((d) => d.status === 'ready');

  useEffect(() => {
    checkAll();

    let unlisten: (() => void) | undefined;
    if (window.electronAPI?.onSetupDependencyProgress) {
      unlisten = window.electronAPI.onSetupDependencyProgress((data: { id: string; percent: number; message?: string }) => {
        if (data.message) {
          lastMessageRef.current[data.id] = data.message;
        }

        setDependencies((prev) =>
          prev.map((item) => {
            if (item.id === data.id) {
              // Allow backend to reset progress to 0 on cancellation/error while preventing backwards jitter during normal progress
              const lastPct = lastProgressRef.current[data.id] ?? 0;
              const newPct = data.percent === 0 ? 0 : Math.max(lastPct, Math.min(100, data.percent));
              lastProgressRef.current[data.id] = newPct;

              return {
                ...item,
                progress: newPct,
                details: data.message || item.details,
                // Keep 'installing' until installSetupDependency resolves and checkAll() verifies
                status: item.status === 'ready' ? 'ready' : 'installing'
              };
            }
            return item;
          })
        );
      });
    }

    const handleWindowFocus = () => {
      if (wizardStepRef.current === 'dependencies' && !allReadyRef.current && installingIdsRef.current.size === 0) {
        checkAll();
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (unlisten) unlisten();
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);

  const checkAll = async () => {
    setIsChecking(true);
    if (window.electronAPI?.checkSetupDependencies) {
      try {
        const results = await window.electronAPI.checkSetupDependencies();
        const filteredResults = results.filter((res: any) => res.id === 'java' || res.id === 'cloud_relay');
        setDependencies(prev => {
          return filteredResults.map((res: DepItem) => {
            const existing = prev.find(p => p.id === res.id);
            // Preserve 'queued' or 'installing' state if backend says missing
            if (existing && (existing.status === 'queued' || existing.status === 'installing') && res.status !== 'ready') {
              return { ...res, status: existing.status, details: existing.details, progress: existing.progress };
            }
            // If still missing after an explicit failure/cancel message, preserve that helpful feedback
            if (res.status !== 'ready' && existing?.status === 'error' && existing.details) {
              return { ...res, status: 'error', details: existing.details };
            }
            if (res.status === 'ready') {
              delete lastMessageRef.current[res.id];
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
          { id: 'cloud_relay', name: DEP_META.cloud_relay.label, description: DEP_META.cloud_relay.desc, status: 'missing', progress: 0 }
        ]);
      }, 500);
    }
    setIsChecking(false);
  };

  const handleInstallSingle = async (id: DepItem['id']) => {
    if (installingIdsRef.current.has(id)) return;
    installingIdsRef.current.add(id);

    // Reset progress and message tracker for this item
    lastProgressRef.current[id] = 0;
    delete lastMessageRef.current[id];

    setDependencies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'installing', progress: 0, details: 'Starting...' } : item))
    );

    try {
      if (window.electronAPI?.installSetupDependency) {
        try {
          const success = await window.electronAPI.installSetupDependency(id);
          if (success) {
            lastProgressRef.current[id] = 100;
            setDependencies((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, status: 'ready', progress: 100, details: lastMessageRef.current[id] || DEP_META[id].readyLabel }
                  : item
              )
            );
          } else {
            const failMsg = lastMessageRef.current[id] || 'Installation was not completed — try again';
            setDependencies((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: 'error', progress: 0, details: failMsg } : item))
            );
          }
        } catch (err: any) {
          const errMsg = err?.message || lastMessageRef.current[id] || 'Download error — please try again';
          setDependencies((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: 'error', progress: 0, details: errMsg } : item))
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
    } finally {
      installingIdsRef.current.delete(id);
    }
  };

  const handleInstallAll = async () => {
    if (isInstallingAll) return;
    setIsInstallingAll(true);
    const missing = dependencies.filter((d) => d.status !== 'ready');

    // Immediately mark all pending items as queued
    setDependencies((prev) =>
      prev.map((item) =>
        item.status !== 'ready' ? { ...item, status: 'queued', details: 'In queue...' } : item
      )
    );

    try {
      for (const dep of missing) {
        await handleInstallSingle(dep.id);
      }
    } finally {
      setIsInstallingAll(false);
      await checkAll();
    }
  };

  const readyCount = dependencies.filter((d) => d.status === 'ready').length;
  const allReady = readyCount === dependencies.length;

  // Step 2: PlayIt.gg Setup
  if (wizardStep === 'playit') {
    return (
      <PlayitSetupScreen
        onBack={() => {
          if (window.electronAPI?.setSetupStep) {
            window.electronAPI.setSetupStep('dependencies');
          }
          setWizardStep('dependencies');
        }}
        onComplete={onSetupComplete}
      />
    );
  }

  // Step 1: Download dependencies
  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto max-h-screen">
      {/* Header */}
      <div className="text-center mb-6 pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-neutral-bg border border-border-default text-black dark:text-content-primary text-xs font-bold uppercase tracking-wider mb-3">
          <span>Step 1 of 2 — Download Required Files</span>
        </div>
        <h2 className="text-3xl font-extrabold text-black dark:text-content-primary mb-2 tracking-tight">
          Get Your Server Ready
        </h2>
        <p className="text-content-secondary text-sm max-w-2xl mx-auto">
          Download the 2 components CraftTogether needs to run your server. This only happens once — everything is saved to your workspace for future use.
        </p>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-surface-elevated/80 p-4 rounded-2xl border border-border-default mb-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div>
            <h4 className="text-sm font-bold text-black dark:text-content-primary">
              {allReady ? 'Everything is ready!' : `${2 - readyCount} item${2 - readyCount === 1 ? '' : 's'} left to download`}
            </h4>
            <p className="text-xs text-content-secondary">
              {allReady
                ? 'All components are downloaded and ready to use.'
                : 'Click "Download All" to get everything at once.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkAll}
            disabled={isChecking}
            className="px-4 py-2.5 rounded-xl bg-success hover:bg-success/90 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center gap-1.5"
            title="Refresh"
          >
            Refresh
          </button>

          {!allReady && (
            <button
              onClick={handleInstallAll}
              disabled={isInstallingAll || isChecking}
              className="px-5 py-2.5 rounded-xl bg-success hover:bg-success/90 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <span>{isInstallingAll ? 'Downloading...' : 'Download All'}</span>
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
          buttonLabel="Download Java"
          disabled={isInstallingAll}
        />

        {/* PlayIt.gg */}
        <DepCard
          id="cloud_relay"
          icon={<PlayItIcon className="w-11 h-11 rounded-xl" />}
          iconPadding="p-1.5"
          dep={dependencies.find((d) => d.id === 'cloud_relay')!}
          meta={DEP_META.cloud_relay}
          onInstall={() => handleInstallSingle('cloud_relay')}
          buttonLabel="Download Tunnel"
          disabled={isInstallingAll}
        />
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-end pt-2 border-t border-border-default mt-auto">
        <button
          type="button"
          disabled={!allReady}
          onClick={() => {
            if (window.electronAPI?.setSetupStep) {
              window.electronAPI.setSetupStep('playit');
            }
            setWizardStep('playit');
          }}
          className={`px-6 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg ${
            allReady 
              ? 'bg-success hover:bg-success/90 text-white cursor-pointer' 
              : 'bg-neutral-bg text-content-secondary cursor-not-allowed'
          }`}
        >
          <span>Continue</span>
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
  disabled?: boolean;
}

const DepCard: React.FC<DepCardProps> = ({ id, icon, dep, meta, onInstall, buttonLabel, disabled = false }) => {
  const installingBadgeLabel =
    id === 'java'
      ? dep.progress >= 90
        ? 'Verifying'
        : dep.progress >= 78
          ? 'Installing'
          : 'Downloading'
      : 'Downloading';

  return (
    <div className="bg-surface-elevated border border-border-default rounded-xl p-5 flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-start justify-between mb-3">
          {icon}

          {dep.status === 'ready' ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-content-primary bg-surface-base px-2.5 py-1 rounded border border-border-default">
              <span className="text-success font-bold">✓</span>
              {meta.readyLabel}
            </span>
          ) : dep.status === 'installing' ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-content-primary bg-neutral-bg px-2.5 py-1 rounded border border-border-default">
              <span className="w-3 h-3 rounded-full border-2 border-content-primary border-t-transparent animate-spin inline-block" />
              {installingBadgeLabel}
            </span>
          ) : dep.status === 'queued' ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-warning-fg bg-warning/10 px-2.5 py-1 rounded border border-warning-fg/30">
              In Queue
            </span>
          ) : dep.status === 'error' ? (
            <span className="text-[11px] font-semibold text-danger-fg bg-danger/10 px-2.5 py-1 rounded border border-danger-fg/30">
              Action Needed
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-content-secondary bg-neutral-bg px-2.5 py-1 rounded">
              Not Downloaded
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-content-primary">{meta.label}</h3>
        <p className="text-xs text-content-secondary mt-1 leading-relaxed">{meta.desc}</p>

        {dep.status === 'ready' && dep.details && (
          <p className="text-[11px] text-success font-medium mt-1.5">{dep.details}</p>
        )}

        {dep.status === 'error' && dep.details && (
          <p className="text-[11px] text-danger-fg mt-1.5 leading-relaxed">{dep.details}</p>
        )}
      </div>

      {dep.status === 'installing' && (
        <div className="space-y-1.5">
          <div className="flex justify-between gap-2 text-[11px] text-content-secondary">
            <span className="truncate">{dep.details || 'Downloading...'}</span>
            <span className="shrink-0">{dep.progress}%</span>
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
          disabled={disabled}
          className="w-full py-2 rounded-lg bg-success hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{dep.status === 'error' ? `Retry ${buttonLabel}` : buttonLabel}</span>
        </button>
      )}
    </div>
  );
};
