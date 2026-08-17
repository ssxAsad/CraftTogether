import React, { useState, useEffect } from 'react';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  Layers,
  Plug,
  ArrowRight,
  Loader2,
  Globe2,
  Sparkles,
  RefreshCw,
  Zap,
  Check,
  ShieldCheck
} from 'lucide-react';

interface GlobalSetupScreenProps {
  onSetupComplete: () => void;
}

interface DepItem {
  id: 'java' | 'ngrok' | 'papermc' | 'plugins';
  name: string;
  description: string;
  status: 'ready' | 'missing' | 'installing' | 'error';
  progress: number;
  error?: string;
  details?: string;
}

export const GlobalSetupScreen: React.FC<GlobalSetupScreenProps> = ({ onSetupComplete }) => {
  const [dependencies, setDependencies] = useState<DepItem[]>([
    {
      id: 'java',
      name: 'Java 21 JRE Runtime',
      description: 'Required engine to run modern Minecraft servers (1.20.5+)',
      status: 'missing',
      progress: 0
    },
    {
      id: 'ngrok',
      name: 'ngrok Cloud Tunnel Agent',
      description: 'Zero-config tunnel client saved in workspace for free internet play',
      status: 'missing',
      progress: 0
    },
    {
      id: 'papermc',
      name: 'PaperMC 1.21.4 Server Core',
      description: 'High-performance Minecraft server jar pre-cached in workspace',
      status: 'missing',
      progress: 0
    },
    {
      id: 'plugins',
      name: 'Essential Plugins (SkinsRestorer & Geyser Cross-Play)',
      description: 'Bedrock iOS/Android/Xbox cross-play & player skins for cracked mode',
      status: 'missing',
      progress: 0
    }
  ]);

  const [isInstallingAll, setIsInstallingAll] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkAll();

    let unlisten: (() => void) | undefined;
    if (window.electronAPI?.onSetupDependencyProgress) {
      unlisten = window.electronAPI.onSetupDependencyProgress((data: { id: string; percent: number; message?: string }) => {
        setDependencies((prev) =>
          prev.map((item) => {
            if (item.id === data.id) {
              return {
                ...item,
                progress: data.percent,
                details: data.message || item.details,
                status: data.percent >= 100 ? 'ready' : 'installing'
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
        setDependencies(results);
      } catch (e) {
        console.error('Error checking dependencies', e);
      }
    } else {
      // Browser preview fallback
      setTimeout(() => {
        setDependencies([
          {
            id: 'java',
            name: 'Java 21 JRE Runtime',
            description: 'Required engine to run modern Minecraft servers (1.20.5+)',
            status: 'missing',
            progress: 0
          },
          {
            id: 'ngrok',
            name: 'ngrok Cloud Tunnel Agent',
            description: 'Zero-config tunnel client saved in workspace for free internet play',
            status: 'missing',
            progress: 0
          },
          {
            id: 'papermc',
            name: 'PaperMC 1.21.4 Server Core',
            description: 'High-performance Minecraft server jar pre-cached in workspace',
            status: 'missing',
            progress: 0
          },
          {
            id: 'plugins',
            name: 'Essential Plugins (SkinsRestorer & Geyser Cross-Play)',
            description: 'Bedrock iOS/Android/Xbox cross-play & player skins for cracked mode',
            status: 'missing',
            progress: 0
          }
        ]);
      }, 500);
    }
    setIsChecking(false);
  };

  const handleInstallSingle = async (id: 'java' | 'ngrok' | 'papermc' | 'plugins') => {
    setDependencies((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'installing', progress: 10, error: undefined } : item))
    );

    if (window.electronAPI?.installSetupDependency) {
      try {
        const success = await window.electronAPI.installSetupDependency(id);
        if (id === 'java') {
          // Check again after installer window opens
          setTimeout(checkAll, 3000);
        } else if (success) {
          setDependencies((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: 'ready', progress: 100 } : item))
          );
        }
      } catch (err: any) {
        setDependencies((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: 'error', error: err.message || 'Failed to download dependency' }
              : item
          )
        );
      }
    } else {
      // Browser preview simulation
      for (let p = 10; p <= 100; p += 30) {
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

    for (const dep of missing) {
      await handleInstallSingle(dep.id);
    }
    setIsInstallingAll(false);
    await checkAll();
  };

  const allReady = dependencies.every((d) => d.status === 'ready');
  const readyCount = dependencies.filter((d) => d.status === 'ready').length;

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto max-h-screen">
      {/* Header */}
      <div className="text-center mb-8 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Prerequisites & Pre-caching</span>
        </div>
        <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
          Setup Must-Needed Dependencies
        </h2>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto">
          DukeCraftora is pre-caching your required tools into your selected workspace so servers boot instantly without missing files.
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between bg-obsidian-900/60 p-4 rounded-2xl border border-white/10 mb-6 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono">
            {readyCount}/4
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Prerequisites Status</h4>
            <p className="text-xs text-slate-400">
              {allReady
                ? 'All essential dependencies are installed and cached in your workspace!'
                : `${4 - readyCount} item(s) pending installation`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkAll}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Scan Again</span>
          </button>

          {!allReady && (
            <button
              onClick={handleInstallAll}
              disabled={isInstallingAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 font-bold text-xs transition cursor-pointer"
            >
              {isInstallingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Installing All...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Install All Missing</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 4 Core Dependency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* 1. Java Card */}
        <div className="bg-obsidian-900 border border-white/10 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Coffee className="w-5 h-5" />
              </div>
              {dependencies.find((d) => d.id === 'java')?.status === 'ready' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ready
                </span>
              ) : dependencies.find((d) => d.id === 'java')?.status === 'installing' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-500/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Installing
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-zinc-800 px-2.5 py-1 rounded">
                  Needs Install
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-white">Java 21/25 JRE Runtime</h3>
            <p className="text-xs text-slate-400 mt-1">
              Required by modern Minecraft and PaperMC server engines.
            </p>
          </div>

          {dependencies.find((d) => d.id === 'java')?.status === 'installing' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Downloading installer...</span>
                <span>{dependencies.find((d) => d.id === 'java')?.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-obsidian-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${dependencies.find((d) => d.id === 'java')?.progress}%` }}
                />
              </div>
            </div>
          )}

          {dependencies.find((d) => d.id === 'java')?.status !== 'ready' &&
            dependencies.find((d) => d.id === 'java')?.status !== 'installing' && (
              <button
                onClick={() => handleInstallSingle('java')}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download & Install Java</span>
              </button>
            )}
        </div>

        {/* 2. Ngrok Card */}
        <div className="bg-obsidian-900 border border-white/10 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Globe2 className="w-5 h-5" />
              </div>
              {dependencies.find((d) => d.id === 'ngrok')?.status === 'ready' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ready
                </span>
              ) : dependencies.find((d) => d.id === 'ngrok')?.status === 'installing' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-500/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Downloading
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-zinc-800 px-2.5 py-1 rounded">
                  Needs Download
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-white">ngrok Cloud Tunnel Agent</h3>
            <p className="text-xs text-slate-400 mt-1">
              Provides free 1-click internet sharing without router port forwarding.
            </p>
          </div>

          {dependencies.find((d) => d.id === 'ngrok')?.status === 'installing' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Saving to workspace bin/ngrok.exe...</span>
                <span>{dependencies.find((d) => d.id === 'ngrok')?.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-obsidian-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${dependencies.find((d) => d.id === 'ngrok')?.progress}%` }}
                />
              </div>
            </div>
          )}

          {dependencies.find((d) => d.id === 'ngrok')?.status !== 'ready' &&
            dependencies.find((d) => d.id === 'ngrok')?.status !== 'installing' && (
              <button
                onClick={() => handleInstallSingle('ngrok')}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Pre-cache ngrok</span>
              </button>
            )}
        </div>

        {/* 3. PaperMC Server Core */}
        <div className="bg-obsidian-900 border border-white/10 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Layers className="w-5 h-5" />
              </div>
              {dependencies.find((d) => d.id === 'papermc')?.status === 'ready' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pre-cached
                </span>
              ) : dependencies.find((d) => d.id === 'papermc')?.status === 'installing' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-500/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Downloading
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-zinc-800 px-2.5 py-1 rounded">
                  Needs Download
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-white">PaperMC Server Core</h3>
            <p className="text-xs text-slate-400 mt-1">
              High-performance Minecraft engine for paper servers.
            </p>
          </div>

          {dependencies.find((d) => d.id === 'papermc')?.status === 'installing' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Saving to workspace downloads/...</span>
                <span>{dependencies.find((d) => d.id === 'papermc')?.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-obsidian-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${dependencies.find((d) => d.id === 'papermc')?.progress}%` }}
                />
              </div>
            </div>
          )}

          {dependencies.find((d) => d.id === 'papermc')?.status !== 'ready' &&
            dependencies.find((d) => d.id === 'papermc')?.status !== 'installing' && (
              <button
                onClick={() => handleInstallSingle('papermc')}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Pre-cache PaperMC</span>
              </button>
            )}
        </div>

        {/* 4. Essential Plugins */}
        <div className="bg-obsidian-900 border border-white/10 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <Plug className="w-5 h-5" />
              </div>
              {dependencies.find((d) => d.id === 'plugins')?.status === 'ready' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Plugins Cached
                </span>
              ) : dependencies.find((d) => d.id === 'plugins')?.status === 'installing' ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-500/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Downloading
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-zinc-800 px-2.5 py-1 rounded">
                  Needs Download
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-white">Essential Plugins (Skins, Geyser)</h3>
            <p className="text-xs text-slate-400 mt-1">
              Caches SkinsRestorer, GeyserMC, and Floodgate jars in workspace.
            </p>
          </div>

          {dependencies.find((d) => d.id === 'plugins')?.status === 'installing' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Downloading plugin jars...</span>
                <span>{dependencies.find((d) => d.id === 'plugins')?.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-obsidian-950 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${dependencies.find((d) => d.id === 'plugins')?.progress}%` }}
                />
              </div>
            </div>
          )}

          {dependencies.find((d) => d.id === 'plugins')?.status !== 'ready' &&
            dependencies.find((d) => d.id === 'plugins')?.status !== 'installing' && (
              <button
                onClick={() => handleInstallSingle('plugins')}
                className="w-full py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Pre-cache Essential Plugins</span>
              </button>
            )}
        </div>
      </div>

      {/* Completion button */}
      <div className="mt-auto flex justify-center pb-8">
        <button
          onClick={onSetupComplete}
          disabled={!allReady}
          className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-xs transition-all ${
            allReady
              ? 'bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 cursor-pointer'
              : 'bg-zinc-800 text-slate-500 cursor-not-allowed border border-white/5 opacity-60'
          }`}
        >
          {allReady ? (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Finish Setup & Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <span>Install Must-Needed Dependencies to Continue</span>
          )}
        </button>
      </div>
    </div>
  );
};
