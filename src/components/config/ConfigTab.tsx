import React, { useState, useEffect } from 'react';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { useTheme } from '../../context/ThemeContext';
import { ServerProperties } from '../../types';
import { GlassCard } from '../common/GlassCard';
import { Check, Cpu, Server, Shield, Zap, Layers, Sun, Moon } from 'lucide-react';

export const ConfigTab: React.FC = () => {
  const { activeServer, javaRuntimes } = useServerState();
  const { updateServerConfig, refreshServers, loadJavaRuntimes } = useServerActions();
  const { theme, setTheme } = useTheme();

  const [properties, setProperties] = useState<ServerProperties>({
    'server-port': 25565,
    'spawn-protection': 16,
    'enable-command-block': true,
    'view-distance': 10,
    'simulation-distance': 10
  });

  const [ramGb, setRamGb] = useState(activeServer?.allocatedRamGb || 4);
  const [useAikar, setUseAikar] = useState(activeServer?.useAikarFlags !== false);
  const [selectedJava, setSelectedJava] = useState(activeServer?.javaPath || javaRuntimes[0]?.path || 'java');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load Java Runtimes explicitly when opening the Settings Tab
    if (javaRuntimes.length === 0) {
      loadJavaRuntimes();
    }
  }, [javaRuntimes.length, loadJavaRuntimes]);

  useEffect(() => {
    const loadProps = async () => {
      if (!activeServer) return;
      setRamGb(activeServer.allocatedRamGb || 4);
      setUseAikar(activeServer.useAikarFlags !== false);
      setSelectedJava(activeServer.javaPath || javaRuntimes[0]?.path || 'java');

      if (window.electronAPI?.readProperties) {
        const props = await window.electronAPI.readProperties(activeServer.id);
        if (props) setProperties(props);
      }
    };
    loadProps();
  }, [activeServer, javaRuntimes]);

  const handleSave = async () => {
    if (!activeServer) return;
    setSaving(true);

    if (window.electronAPI) {
      await window.electronAPI.writeProperties({
        serverId: activeServer.id,
        properties
      });
      await updateServerConfig(activeServer.id, {
        allocatedRamGb: ramGb,
        useAikarFlags: useAikar,
        javaPath: selectedJava,
        port: properties['server-port'] || activeServer.port || 25565
      });

      await refreshServers();
    }

    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Server & System Settings</h1>
          <p className="text-xs text-content-secondary">
            Manage JVM memory allocation, garbage collection flags, Java runtimes, and system options
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-success hover:bg-success/80 text-white rounded-lg font-bold text-xs transition cursor-pointer shrink-0 shadow-sm"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Saved!</span>
            </>
          ) : (
            <span>Save Changes</span>
          )}
        </button>
      </div>

      <div className="space-y-6">
        {/* Appearance & Theme Switcher Card */}
        <GlassCard className="rounded-2xl p-6 border-border-default">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border-default flex items-center justify-center text-content-primary">
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-content-primary">Appearance</h3>
                <p className="text-xs text-content-secondary">
                  Switch CraftTogether between Light and Dark theme (applies instantly)
                </p>
              </div>
            </div>

            <div
              role="group"
              aria-label="Theme selection"
              className="inline-flex items-center p-1 rounded-xl bg-surface-base border border-border-default shrink-0 self-start sm:self-auto"
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-success text-white shadow-sm'
                    : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-success text-white shadow-sm'
                    : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        </GlassCard>

        {/* RAM Allocation Slider Card */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-content-primary">Allocated Memory (RAM)</h3>
                <p className="text-xs text-content-secondary">Controls heap size (-Xms and -Xmx)</p>
              </div>
            </div>
            <div className="text-xl font-extrabold text-content-primary font-mono">
              {ramGb} GB
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={2}
              max={32}
              step={1}
              value={ramGb}
              onChange={(e) => setRamGb(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-400 cursor-pointer h-2 bg-surface-base rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-content-muted font-mono">
              <span>2 GB (Budget)</span>
              <span>4 GB (Standard SMP)</span>
              <span>8 GB (Heavy Plugins/World)</span>
              <span>16+ GB (Large Network)</span>
            </div>
          </div>
        </GlassCard>

        {/* JVM Flags Optimization */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-content-primary">Aikar's G1GC Garbage Collection Flags</h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-warning-bg text-warning-fg border-warning-fg/20">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-content-secondary">
                  Pre-configured JVM garbage collector parameters that eliminate tick lag and GC stutter
                </p>
              </div>
            </div>

            <button
              onClick={() => setUseAikar(!useAikar)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${useAikar ? 'bg-success' : 'bg-content-muted'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useAikar ? 'translate-x-[18px]' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </GlassCard>

        {/* Java Runtime Selector */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-content-primary">Java Runtime Binary</h3>
              <p className="text-xs text-content-secondary">Select JVM installation used to launch server</p>
            </div>
          </div>

          <select
            value={selectedJava}
            onChange={(e) => setSelectedJava(e.target.value)}
            className="w-full px-4 py-2.5 bg-surface-base border border-border-default rounded-xl text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
          >
            {javaRuntimes.length > 0 ? (
              javaRuntimes.map((j) => (
                <option key={j.path} value={j.path}>
                  {j.version ? `Java ${j.majorVersion} (${j.version})` : 'System Java'} — {j.path}
                </option>
              ))
            ) : (
              <option value="java">Default System Java (PATH)</option>
            )}
          </select>
        </GlassCard>

        {/* Server System & Port Settings */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
          <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-content-primary">Server System Properties</h3>
              <p className="text-xs text-content-secondary">Configure port binding, command blocks, and spawn protection</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Server Port */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content-primary">Server Port (Java Edition)</label>
              <input
                type="number"
                min={1024}
                max={65535}
                value={properties['server-port'] || 25565}
                onChange={(e) =>
                  setProperties({
                    ...properties,
                    'server-port': parseInt(e.target.value, 10) || 25565
                  })
                }
                className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
              />
              <span className="text-[10px] text-content-muted">Default Minecraft Java port is 25565.</span>
            </div>

            {/* Spawn Protection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content-primary">Spawn Protection Radius</label>
              <input
                type="number"
                min={0}
                max={100}
                value={properties['spawn-protection'] ?? 16}
                onChange={(e) =>
                  setProperties({
                    ...properties,
                    'spawn-protection': parseInt(e.target.value, 10) || 0
                  })
                }
                className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
              />
              <span className="text-[10px] text-content-muted">Blocks from spawn where non-ops cannot place/break blocks (0 to disable).</span>
            </div>

            {/* Enable Command Blocks */}
            <div className="sm:col-span-2 flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div>
                <span className="text-xs font-semibold text-content-primary block">Enable Command Blocks</span>
                <span className="text-[11px] text-content-secondary">Allow redstone command blocks to execute server commands</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setProperties({
                    ...properties,
                    'enable-command-block': properties['enable-command-block'] === false ? true : false
                  })
                }
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${properties['enable-command-block'] !== false ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${properties['enable-command-block'] !== false ? 'translate-x-[18px]' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
        </GlassCard>

        {/* World Render Chunks & Simulation Distance Card */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-content-primary">World Render & Simulation Chunks</h3>
                <p className="text-xs text-content-secondary">
                  Tune client terrain view distance and ticking simulation radius (expanded limit up to 64 chunks)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded border bg-surface-card text-content-secondary border-border-default">
                Chunks Limit: 64
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* View Distance (Render Chunks) */}
            <div className="space-y-3 p-4 bg-surface-base/60 rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-content-primary block">Render Distance (View Distance)</label>
                  <span className="text-[11px] text-content-secondary">Radius of terrain chunks sent to players</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={4}
                    max={64}
                    value={properties['view-distance'] || 10}
                    onChange={(e) => {
                      const val = Math.max(4, Math.min(64, parseInt(e.target.value, 10) || 10));
                      setProperties({ ...properties, 'view-distance': val });
                    }}
                    className="w-16 px-2 py-1 bg-surface-card border border-border-default rounded text-right font-mono text-xs text-content-primary focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-xs font-mono text-content-muted">Chunks</span>
                </div>
              </div>

              <input
                type="range"
                min={4}
                max={64}
                step={1}
                value={properties['view-distance'] || 10}
                onChange={(e) =>
                  setProperties({ ...properties, 'view-distance': parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-surface-base rounded-lg"
              />

              <div className="flex justify-between text-[10px] text-content-muted font-mono">
                <span>4 (Fast)</span>
                <span>10 (Default)</span>
                <span>16 (High)</span>
                <span>32 (Extreme)</span>
                <span>64 (Max)</span>
              </div>

              {/* Performance Indicator Badge */}
              <div className="pt-1">
                {(properties['view-distance'] || 10) <= 8 && (
                  <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Ultra-Performance: Recommended for 2GB–4GB RAM, zero player lag.
                  </div>
                )}
                {(properties['view-distance'] || 10) > 8 && (properties['view-distance'] || 10) <= 12 && (
                  <div className="text-[11px] text-cyan-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Balanced SMP: Optimal balance of render distance and RAM for 4GB servers.
                  </div>
                )}
                {(properties['view-distance'] || 10) > 12 && (properties['view-distance'] || 10) <= 20 && (
                  <div className="text-[11px] text-amber-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    High Detail: High chunk count. Requires 6GB+ RAM to avoid player lag.
                  </div>
                )}
                {(properties['view-distance'] || 10) > 20 && (
                  <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Extreme Render: Generates up to {Math.pow(2 * (properties['view-distance'] || 10) + 1, 2)} chunks per player. Requires 8GB–16GB+ RAM and fast CPU.
                  </div>
                )}
              </div>
            </div>

            {/* Simulation Distance */}
            <div className="space-y-3 p-4 bg-surface-base/60 rounded-xl border border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-content-primary block">Simulation Distance</label>
                  <span className="text-[11px] text-content-secondary">Radius where entities, mobs, and redstone tick</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={3}
                    max={32}
                    value={properties['simulation-distance'] || 10}
                    onChange={(e) => {
                      const val = Math.max(3, Math.min(32, parseInt(e.target.value, 10) || 10));
                      setProperties({ ...properties, 'simulation-distance': val });
                    }}
                    className="w-16 px-2 py-1 bg-surface-card border border-border-default rounded text-right font-mono text-xs text-content-primary focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-xs font-mono text-content-muted">Chunks</span>
                </div>
              </div>

              <input
                type="range"
                min={3}
                max={32}
                step={1}
                value={properties['simulation-distance'] || 10}
                onChange={(e) =>
                  setProperties({ ...properties, 'simulation-distance': parseInt(e.target.value, 10) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-surface-base rounded-lg"
              />

              <div className="flex justify-between text-[10px] text-content-muted font-mono">
                <span>3 (Light AI)</span>
                <span>8 (Recommended)</span>
                <span>16 (Heavy)</span>
                <span>32 (Max)</span>
              </div>

              <div className="pt-1 text-[11px]">
                {(properties['simulation-distance'] || 10) <= 8 ? (
                  <span className="text-emerald-400">Stable 20.0 TPS: Prevents mob & redstone lag spikes for players.</span>
                ) : (
                  <span className="text-amber-400">High Simulation: Mobs and farms run far away, consuming more CPU.</span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
