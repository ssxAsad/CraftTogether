import React, { useState } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { useServer } from '../../context/ServerContext';

export const PerformanceTab: React.FC = () => {
  const { activeServer, javaRuntimes, refreshServers } = useServer();
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
          <div className="w-9 h-9 rounded-xl bg-white/5 text-slate-200 flex items-center justify-center">
            <PlaceholderIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Performance & JVM Optimizer</h1>
            <p className="text-xs text-slate-400">
              Aikar's G1GC Garbage Collection flags & dedicated memory allocation
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 rounded-lg font-bold text-xs transition"
        >
          {saved ? <PlaceholderIcon className="w-4 h-4" /> : <PlaceholderIcon className="w-4 h-4" />}
          <span>{saved ? 'Applied Settings' : 'Apply JVM Settings'}</span>
        </button>
      </div>

      {/* RAM Allocation Slider Card */}
      <div className="glass-card rounded-xl p-6 border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PlaceholderIcon className="w-5 h-5 text-slate-200" />
            <div>
              <h2 className="text-base font-bold text-white">Dedicated Server RAM (Memory)</h2>
              <p className="text-xs text-slate-400">Allocates both -Xms (initial) and -Xmx (maximum) for zero-stutter garbage collection</p>
            </div>
          </div>
          <span className="text-2xl font-black text-slate-200 font-mono">
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
          className="w-full accent-emerald-500 cursor-pointer h-2 bg-obsidian-900 rounded-lg"
        />

        {/* Quick RAM presets */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Quick Presets:</span>
          {[2, 4, 6, 8, 12, 16].map((gb) => (
            <button
              key={gb}
              onClick={() => setRamGb(gb)}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                ramGb === gb
                  ? 'bg-emerald-500 text-obsidian-950'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-slate-300 border border-white/5'
              }`}
            >
              {gb} GB
            </button>
          ))}
        </div>
      </div>

      {/* Java Runtime Selector */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center gap-2.5">
          <PlaceholderIcon className="w-5 h-5 text-slate-200" />
          <div>
            <h2 className="text-base font-bold text-white">Detected Java Runtime (JRE / JDK)</h2>
            <p className="text-xs text-slate-400">Java 21 is required for Minecraft 1.20.5+; Java 17 for 1.18 - 1.20.4</p>
          </div>
        </div>

        <select
          value={selectedJava}
          onChange={(e) => setSelectedJava(e.target.value)}
          className="w-full px-4 py-2.5 bg-obsidian-950 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-white/10"
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
      </div>

      {/* Aikar's Flags Toggle & Preview */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PlaceholderIcon className="w-5 h-5 text-slate-200" />
            <div>
              <h2 className="text-base font-bold text-white">Aikar's Optimized G1GC Flags</h2>
              <p className="text-xs text-slate-400">Industry-standard flags used by top Minecraft networks to eliminate GC lag spikes</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-slate-300 font-semibold">{useAikar ? 'Enabled' : 'Disabled'}</span>
            <input
              type="checkbox"
              checked={useAikar}
              onChange={(e) => setUseAikar(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </label>
        </div>

        <div className="bg-obsidian-950 p-4 rounded-xl border border-white/5 space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Generated JVM Launch Command:
          </span>
          <p className="font-mono text-xs text-slate-200 break-all leading-relaxed select-all">
            java {aikarFlagsPreview.join(' ')} -jar server.jar nogui
          </p>
        </div>
      </div>
    </div>
  );
};
