import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  RotateCw,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Activity,
  Users,
  Wifi,
  Smartphone,
  ShieldAlert,
  ArrowUpRight,
  FolderOpen
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useNetwork } from '../../context/NetworkContext';
import confetti from 'canvas-confetti';

interface DashboardTabProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ onNavigateTab }) => {
  const { activeServer, status, metrics, startServer, stopServer, killServer } = useServer();
  const { ngrokStatus, localIp } = useNetwork();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [bedrockPort, setBedrockPort] = useState<number>(19132);

  useEffect(() => {
    if (activeServer && window.electronAPI) {
      window.electronAPI.getGeyserConfig(activeServer.id).then((cfg: any) => {
        if (cfg && cfg.bedrockPort) {
          setBedrockPort(cfg.bedrockPort);
        }
      }).catch(() => {});
    }
  }, [activeServer]);

  const getBedrockIp = () => {
    if (activeServer?.networkMode === 'lan_only') {
      return localIp;
    }
    if (activeServer?.networkMode === 'ngrok_lan') {
      if (ngrokStatus.publicUrl) {
        return ngrokStatus.publicUrl.replace('tcp://', '').split(':')[0];
      }
      return localIp;
    }
    return localIp;
  };

  const bedrockIp = getBedrockIp();

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleStart = async () => {
    const ok = await startServer();
    if (ok) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const ramMaxMb = (activeServer?.allocatedRamGb || 4) * 1024;
  const ramPercent = Math.min(100, Math.round((metrics.memoryMb / ramMaxMb) * 100)) || 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Top Hero Banner */}
      <div className="rounded-xl glass-panel p-6 border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Server identity & state */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full ${
                  status === 'ONLINE'
                    ? 'bg-emerald-500'
                    : status === 'STARTING'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-zinc-600'
                }`}
              />
              <h1 className="text-xl font-bold text-white tracking-tight">
                {activeServer?.name || 'DukeCraftora Server'}
              </h1>
              <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                {activeServer?.serverSoftware.toUpperCase()} {activeServer?.version}
              </span>
              <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${
                activeServer?.networkMode === 'lan_only'
                  ? 'bg-zinc-800 text-zinc-300 border-zinc-700/50'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
              }`}>
                {activeServer?.networkMode === 'lan_only' ? 'Only LAN' : 'Ngrok + LAN'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Uptime: <strong className="text-slate-200 font-mono">{formatUptime(metrics.uptimeSeconds)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Default Port: <strong className="text-emerald-400 font-mono">{activeServer?.port || 25565}</strong>
              </span>
              {activeServer?.isCracked && (
                <span className="px-2 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-500/30 text-[11px] font-medium">
                  Cracked Enabled
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {status === 'STOPPED' || status === 'CRASHED' ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 font-bold text-xs shadow-sm transition active:translate-y-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Server</span>
              </button>
            ) : status === 'STARTING' ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs animate-pulse cursor-not-allowed"
              >
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Starting Up...</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={stopServer}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs transition"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop</span>
                </button>
                <button
                  onClick={killServer}
                  title="Force Kill (Emergency)"
                  className="p-2.5 rounded-lg bg-zinc-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-white/10 transition"
                >
                  <ShieldAlert className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Meter */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">CPU Usage</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics.cpu}%
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.cpu > 80 ? 'bg-red-500' : metrics.cpu > 50 ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(metrics.cpu, 100)}%` }}
            />
          </div>
        </div>

        {/* RAM Usage */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">RAM Usage</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics.memoryMb} <span className="text-xs text-slate-400 font-sans font-normal">/ {ramMaxMb} MB</span>
          </div>
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                ramPercent > 85 ? 'bg-red-500' : ramPercent > 65 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${ramPercent}%` }}
            />
          </div>
        </div>

        {/* TPS (Ticks Per Second) */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Server TPS</span>
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
            {status === 'ONLINE' ? metrics.tps.toFixed(1) : '--'}
            <span className="text-xs text-emerald-400 font-sans font-medium">
              {status === 'ONLINE' ? 'Optimal (20.0)' : 'Idle'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-400 transition-all duration-500"
              style={{ width: status === 'ONLINE' ? '100%' : '0%' }}
            />
          </div>
        </div>

        {/* Online Players */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Players</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center justify-between">
            <span>{metrics.onlinePlayers} <span className="text-xs text-slate-400 font-sans font-normal">/ {metrics.maxPlayers}</span></span>
            <button
              onClick={() => onNavigateTab('players')}
              className="text-xs text-amber-400 hover:underline flex items-center gap-0.5"
            >
              View <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${(metrics.onlinePlayers / metrics.maxPlayers) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Join Addresses & Connectivity Widget based on active server's networkMode */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Internet / Public Access (Ngrok) or Local Access (LAN) */}
        {activeServer?.networkMode === 'lan_only' ? (
          <div className="glass-card rounded-xl p-5 border border-violet-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Only LAN Mode</h2>
                  <p className="text-xs text-slate-400">Offline network for friends on your same Wi-Fi</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/30">
                LAN
              </span>
            </div>

            <div className="flex items-center justify-between bg-obsidian-950/80 p-3 rounded-lg border border-violet-500/30">
              <span className="font-mono text-xs text-violet-300 font-semibold select-all truncate">
                {localIp}:{activeServer?.port || 25565}
              </span>
              <button
                onClick={() => handleCopy(`${localIp}:${activeServer?.port || 25565}`, 'lan-only-ip')}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 rounded transition"
              >
                {copiedKey === 'lan-only-ip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'lan-only-ip' ? 'Copied' : 'Copy Local IP'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="glass-card rounded-xl p-5 border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Ngrok Public Address</h2>
                  <p className="text-xs text-slate-400">Share with friends over the internet</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  ngrokStatus.isActive
                    ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {ngrokStatus.isActive ? 'Active' : 'Offline'}
              </span>
            </div>

            {ngrokStatus.isActive && ngrokStatus.serverAddress ? (
              <div className="flex items-center justify-between bg-obsidian-950/80 p-3 rounded-lg border border-cyan-500/30">
                <span className="font-mono text-xs text-cyan-300 font-semibold select-all truncate">
                  {ngrokStatus.serverAddress}
                </span>
                <button
                  onClick={() => handleCopy(ngrokStatus.serverAddress!, 'ngrok')}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 rounded transition"
                >
                  {copiedKey === 'ngrok' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'ngrok' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-obsidian-950/40 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                <span>ngrok tunnel is not running.</span>
                <button
                  onClick={() => onNavigateTab('network')}
                  className="text-cyan-400 hover:underline font-medium"
                >
                  Start in Network Tab →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Card 2: Bedrock & Mobile Cross-Play Connection Guide */}
        <div className="glass-card rounded-xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Bedrock Server</h2>
              <p className="text-xs text-slate-400">Enter IP and Port in Minecraft Bedrock to join</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-obsidian-950/80 p-2.5 rounded-lg border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">IP</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-200 truncate select-all font-medium">
                  {bedrockIp}
                </span>
                <button
                  onClick={() => handleCopy(bedrockIp, 'bedrock-ip')}
                  className="text-slate-400 hover:text-white"
                  title="Copy IP"
                >
                  {copiedKey === 'bedrock-ip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-obsidian-950/80 p-2.5 rounded-lg border border-white/5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Port</span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-emerald-300 font-semibold font-mono">
                  {bedrockPort}
                </span>
                <button
                  onClick={() => handleCopy(bedrockPort.toString(), 'bedrock-port')}
                  className="text-slate-400 hover:text-white"
                  title="Copy Port"
                >
                  {copiedKey === 'bedrock-port' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
