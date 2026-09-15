import React, { useState } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { GlassCard } from '../common/GlassCard';

export const PerformanceTab: React.FC = () => {
  const { activeServer, javaRuntimes } = useServerState();
  const { refreshServers } = useServerActions();
  const [ramGb, setRamGb] = useState(activeServer?.allocatedRamGb || 4);
  const [useAikar, setUseAikar] = useState(activeServer?.useAikarFlags !== false);
  const [selectedJava, setSelectedJava] = useState(activeServer?.javaPath || javaRuntimes[0]?.path || 'java');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (activeServer) {
      activeServer.allocatedRamGb = ramGb;
      activeServer.useAikarFlags = useAikar;
      activeServer.javaPath = selectedJava;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const aikarFlagsPreview = [
    `-Xms${ramGb}G`,
    `-Xmx${ramGb}G`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200',
    '-XX:+UnlockExperimentalVMOptions',
    '-XX:+DisableExplicitGC',
    '-XX:+AlwaysPreTouch',
    '-XX:G1NewSizePercent=30',
    '-XX:G1MaxNewSizePercent=40',
    '-XX:G1ReservePercent=20',
    '-XX:G1HeapWastePercent=5',
    '-XX:G1MixedGCCountTarget=4',
    '-XX:InitiatingHeapOccupancyPercent=15',
    '-XX:G1MixedGCLiveThresholdPercent=90',
    '-XX:G1RSetUpdatingPauseTimePercent=5',
    '-XX:SurvivorRatio=32',
    '-XX:+PerfDisableSharedMem',
    '-XX:MaxTenuringThreshold=1',
    '-Dusing.aikars.flags=https://mcflags.emc.gs',
    '-Daikars.new.flags=true'
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-bg text-content-primary flex items-center justify-center">
            <PlaceholderIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-content-primary">Performance & JVM Optimizer</h1>
            <p className="text-xs text-content-secondary">
              Aikar's G1GC Garbage Collection flags & dedicated memory allocation
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success/80 text-white rounded-lg font-bold text-xs transition"
        >
          {saved ? <PlaceholderIcon className="w-4 h-4" /> : <PlaceholderIcon className="w-4 h-4" />}
          <span>{saved ? 'Applied Settings' : 'Apply JVM Settings'}</span>
        </button>
      </div>

      {/* RAM Allocation Slider Card */}
      <GlassCard className="rounded-xl p-6 border-border-default space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PlaceholderIcon className="w-5 h-5 text-content-primary" />
            <div>
              <h2 className="text-base font-bold text-content-primary">Dedicated Server RAM (Memory)</h2>
              <p className="text-xs text-content-secondary">Allocates both -Xms (initial) and -Xmx (maximum) for zero-stutter garbage collection</p>
            </div>
          </div>
          <span className="text-2xl font-black text-content-primary font-mono">
            {ramGb} GB
          </span>
        </div>

        <input
          type="range"
          min={2}
          max={32}
          step={1}
          value={ramGb}
          onChange={(e) => setRamGb(parseInt(e.target.value, 10))}
          className="w-full accent-emerald-500 cursor-pointer h-2 bg-surface-elevated rounded-lg"
        />

        {/* Quick RAM presets */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-content-secondary">Quick Presets:</span>
          {[2, 4, 6, 8, 12, 16].map((gb) => (
            <button
              key={gb}
              onClick={() => setRamGb(gb)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                ramGb === gb
                  ? 'bg-success text-white'
                  : 'bg-surface-card hover:bg-surface-hover text-content-primary border border-border-subtle'
              }`}
            >
              {gb} GB
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Java Runtime Selector */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
        <div className="flex items-center gap-2.5">
          <PlaceholderIcon className="w-5 h-5 text-content-primary" />
          <div>
            <h2 className="text-base font-bold text-content-primary">Detected Java Runtime (JRE / JDK)</h2>
            <p className="text-xs text-content-secondary">Java 21 is required for Minecraft 1.20.5+; Java 17 for 1.18 - 1.20.4</p>
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
                Java {j.majorVersion} ({j.vendor} - {j.version}) — {j.path}
              </option>
            ))
          ) : (
            <option value="java">Default System Java (java on PATH)</option>
          )}
        </select>
      </GlassCard>

      {/* Aikar's Flags Toggle & Preview */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PlaceholderIcon className="w-5 h-5 text-content-primary" />
            <div>
              <h2 className="text-base font-bold text-content-primary">Aikar's Optimized G1GC Flags</h2>
              <p className="text-xs text-content-secondary">Industry-standard flags used by top Minecraft networks to eliminate GC lag spikes</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-content-primary font-semibold">{useAikar ? 'Enabled' : 'Disabled'}</span>
            <input
              type="checkbox"
              checked={useAikar}
              onChange={(e) => setUseAikar(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </label>
        </div>

        <div className="bg-surface-base p-4 rounded-xl border border-border-subtle space-y-2">
          <span className="text-[11px] font-bold text-content-secondary uppercase tracking-wider block">
            Generated JVM Launch Command:
          </span>
          <p className="font-mono text-xs text-content-primary break-all leading-relaxed select-all">
            java {aikarFlagsPreview.join(' ')} -jar server.jar nogui
          </p>
        </div>
      </GlassCard>
    </div>
  );
};
