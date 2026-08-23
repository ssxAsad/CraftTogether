import React, { useState, useEffect, useRef } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { Play, Square, RotateCw, X, Copy, Check } from 'lucide-react';
import { PlayItIcon } from '../common/Icons';
import { useServer } from '../../context/ServerContext';
import { useNetwork } from '../../context/NetworkContext';
import confetti from 'canvas-confetti';

interface DashboardTabProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ onNavigateTab }) => {
  const { activeServer, status, metrics, startServer, stopServer, killServer } = useServer();
  const {
    cloudTunnelStatus,
    upnpStatus,
    localIp,
    publicIp,
    startCloudTunnel,
    stopCloudTunnel,
    startUpnp,
    stopUpnp,
    isLoadingNetwork
  } = useNetwork();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [bedrockPort, setBedrockPort] = useState<number>(19132);
  const [cloneRemotePort, setCloneRemotePort] = useState<boolean>(true);

  useEffect(() => {
    if (activeServer && window.electronAPI) {
      window.electronAPI.getGeyserConfig(activeServer.id).then((cfg: any) => {
        if (cfg) {
          if (cfg.bedrockPort) setBedrockPort(cfg.bedrockPort);
          if (cfg.cloneRemotePort !== undefined) setCloneRemotePort(cfg.cloneRemotePort);
        }
      }).catch(() => {});
    }
  }, [activeServer]);

  const getBedrockIp = () => {
    if (activeServer?.networkMode === 'lan_only') {
      return localIp;
    }
    if (activeServer?.networkMode === 'upnp') {
      return publicIp || upnpStatus.externalIp || localIp;
    }
    if (cloudTunnelStatus.bedrockAddress) {
      return cloudTunnelStatus.bedrockAddress.split(':')[0];
    }
    if (cloudTunnelStatus.serverAddress) {
      return cloudTunnelStatus.serverAddress.split(':')[0];
    }
    return localIp;
  };

  const getDisplayBedrockPort = () => {
    if (activeServer?.networkMode === 'cloud_relay') {
      if (cloudTunnelStatus.bedrockAddress) {
        const parts = cloudTunnelStatus.bedrockAddress.split(':');
        if (parts.length > 1) {
          return parseInt(parts[1], 10);
        }
      } else if (cloudTunnelStatus.serverAddress) {
        const parts = cloudTunnelStatus.serverAddress.split(':');
        if (parts.length > 1) {
          return parseInt(parts[1], 10);
        }
      }
    }
    return cloneRemotePort ? (activeServer?.port || 25565) : bedrockPort;
  };

  const bedrockIp = getBedrockIp();
  const displayBedrockPort = getDisplayBedrockPort();

  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (prevStatusRef.current === 'STARTING' && status === 'ONLINE') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
    prevStatusRef.current = status;
  }, [status]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleStart = async () => {
    await startServer();
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
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-zinc-600'
                }`}
              />
              <h1 className="text-xl font-bold text-white tracking-tight">
                {activeServer?.name || 'Craftora Server'}
              </h1>
              <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                {activeServer?.serverSoftware.toUpperCase()} {activeServer?.version}
              </span>
              <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${
                activeServer?.networkMode === 'lan_only'
                  ? 'bg-zinc-800 text-zinc-300 border-zinc-700/50'
                  : 'bg-white/5 text-slate-200 border-white/10'
              }`}>
                {activeServer?.networkMode === 'lan_only'
                  ? 'Only LAN'
                  : activeServer?.networkMode === 'upnp'
                  ? 'Direct UPnP'
                  : 'PlayIt.gg'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Uptime: <strong className="text-slate-200 font-mono">{formatUptime(metrics.uptimeSeconds)}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                Default Port: <strong className="text-slate-200 font-mono">{activeServer?.port || 25565}</strong>
              </span>
              {activeServer?.isCracked && (
                <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 text-[11px] font-medium">
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
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 text-slate-300 border border-white/10 font-bold text-xs animate-pulse cursor-not-allowed"
              >
                <RotateCw className="w-4 h-4 animate-spin text-slate-200" />
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
                  <X className="w-4 h-4" />
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
            <PlaceholderIcon className="w-4 h-4 text-slate-200" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics.cpu}%
          </div>
            {/* Progress bar */}
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.cpu > 80 ? 'bg-red-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(metrics.cpu, 100)}%` }}
            />
          </div>
        </div>

        {/* RAM Usage */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">RAM Usage</span>
            <PlaceholderIcon className="w-4 h-4 text-slate-200" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {metrics.memoryMb} <span className="text-xs text-slate-400 font-sans font-normal">/ {ramMaxMb} MB</span>
          </div>
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                ramPercent > 85 ? 'bg-red-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${ramPercent}%` }}
            />
          </div>
        </div>

        {/* TPS (Ticks Per Second) */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Server TPS</span>
            <PlaceholderIcon className="w-4 h-4 text-slate-200" />
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center gap-2">
            {status === 'ONLINE' ? metrics.tps.toFixed(1) : '--'}
            <span className="text-xs text-slate-200 font-sans font-medium">
              {status === 'ONLINE' ? 'Optimal (20.0)' : 'Idle'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: status === 'ONLINE' ? '100%' : '0%' }}
            />
          </div>
        </div>

        {/* Online Players */}
        <div className="glass-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider">Players</span>
            <PlaceholderIcon className="w-4 h-4 text-slate-200" />
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center justify-between">
            <span>{metrics.onlinePlayers} <span className="text-xs text-slate-400 font-sans font-normal">/ {metrics.maxPlayers}</span></span>
            <button
              onClick={() => onNavigateTab('players')}
              className="text-xs text-slate-200 hover:underline flex items-center gap-0.5"
            >
              View <PlaceholderIcon className="w-3 h-3" />
            </button>
          </div>
          <div className="w-full h-1.5 bg-obsidian-850 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(metrics.onlinePlayers / metrics.maxPlayers) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Join Addresses & Connectivity Widget based on active server's networkMode */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Internet / Public Access (Cloud Relay / UPnP) or Local Access (LAN) */}
        {activeServer?.networkMode === 'lan_only' ? (
          <div className="glass-card rounded-xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div>
                  <h2 className="text-sm font-bold text-white">Only LAN Mode</h2>
                  <p className="text-xs text-slate-400">Offline network for friends on your same Wi-Fi</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                LAN
              </span>
            </div>

            <div className="flex items-center justify-between bg-obsidian-950/80 p-3 rounded-lg border border-white/10">
              <span className="font-mono text-xs text-white font-semibold select-all truncate">
                {localIp}:{activeServer?.port || 25565}
              </span>
              <button
                onClick={() => handleCopy(`${localIp}:${activeServer?.port || 25565}`, 'lan-only-ip')}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-white/5 text-slate-200 hover:bg-white/5 rounded transition"
              >
                {copiedKey === 'lan-only-ip' ? <Check className="w-3.5 h-3.5 text-slate-200" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'lan-only-ip' ? 'Copied' : 'Copy Local IP'}</span>
              </button>
            </div>
          </div>
        ) : null}
        {activeServer?.networkMode !== 'lan_only' && (
          <div className="glass-card rounded-xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {activeServer?.networkMode === 'upnp' ? 'Direct UPnP IP' : 'PlayIt.gg Tunnel'}
                  </h2>
                  <p className="text-xs text-slate-400">Share with friends over the internet</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  (activeServer?.networkMode === 'upnp' ? upnpStatus.isActive : (cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE'))
                    ? 'bg-white/5 text-slate-200 border-white/10'
                    : cloudTunnelStatus.status === 'WAITING_CLAIM'
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : cloudTunnelStatus.status === 'STARTING'
                    ? 'bg-white/5 text-slate-300 border-white/10'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
              >
                {activeServer?.networkMode === 'upnp'
                  ? (upnpStatus.isActive ? 'Active' : 'Offline')
                  : cloudTunnelStatus.status === 'ONLINE'
                  ? 'Active'
                  : cloudTunnelStatus.status === 'WAITING_CLAIM'
                  ? 'Claim Needed'
                  : cloudTunnelStatus.status === 'STARTING'
                  ? 'Connecting...'
                  : 'Offline'}
              </span>
            </div>

            {activeServer?.networkMode === 'upnp' ? (
              upnpStatus.isActive ? (
                <div className="flex items-center justify-between bg-obsidian-950/80 p-3 rounded-lg border border-white/10">
                  <span className="font-mono text-xs text-white font-semibold select-all truncate">
                    {publicIp || upnpStatus.externalIp}:{activeServer.port || 25565}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(`${publicIp || upnpStatus.externalIp}:${activeServer.port || 25565}`, 'upnp-ip')}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-white/5 text-slate-200 hover:bg-white/5 rounded transition cursor-pointer"
                    >
                      {copiedKey === 'upnp-ip' ? <Check className="w-3.5 h-3.5 text-slate-200" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'upnp-ip' ? 'Copied' : 'Copy IP'}</span>
                    </button>
                    <button
                      onClick={() => stopUpnp()}
                      className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 rounded transition cursor-pointer"
                      title="Stop UPnP Port Mapping"
                    >
                      <span>Turn Off</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 bg-obsidian-950/40 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                  <span>UPnP port forwarding is offline.</span>
                  <button
                    onClick={() => startUpnp(activeServer?.port || 25565)}
                    disabled={isLoadingNetwork}
                    className="flex items-center gap-1.5 px-3 py-2 leading-none bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold rounded-lg text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {isLoadingNetwork ? (
                      <PlaceholderIcon className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <PlaceholderIcon className="w-3.5 h-3.5" />
                    )}
                    <span>Turn On</span>
                  </button>
                </div>
              )
            ) : cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress ? (
              <div className="flex items-center justify-between bg-obsidian-950/80 p-3 rounded-lg border border-white/10">
                <span className="font-mono text-xs text-white font-semibold select-all truncate">
                  {cloudTunnelStatus.serverAddress}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(cloudTunnelStatus.serverAddress!, 'cloud')}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-white/5 text-slate-200 hover:bg-white/5 rounded transition cursor-pointer"
                  >
                    {copiedKey === 'cloud' ? <Check className="w-3.5 h-3.5 text-slate-200" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'cloud' ? 'Copied' : 'Copy IP'}</span>
                  </button>
                  <button
                    onClick={() => stopCloudTunnel()}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 rounded transition cursor-pointer"
                    title="Stop Tunnel"
                  >
                    <span>Turn Off</span>
                  </button>
                </div>
              </div>
            ) : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'STARTING' ? (
              <div className="flex items-center justify-between bg-obsidian-900 p-3 rounded-lg border border-white/10 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <PlaceholderIcon className="w-4 h-4 animate-spin text-slate-200 shrink-0" />
                  <span>Connecting to Playit.gg tunnel...</span>
                </div>
                <button
                  onClick={() => stopCloudTunnel()}
                  className="px-2.5 py-1 text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 rounded transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : cloudTunnelStatus.status === 'WAITING_CLAIM' && cloudTunnelStatus.claimUrl ? (
              <div className="flex items-center justify-between bg-obsidian-900 p-3 rounded-lg border border-white/10 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <PlaceholderIcon className="w-4 h-4 text-slate-200 shrink-0" />
                  <span>Free domain ready to claim</span>
                </div>
                <button
                  onClick={() => {
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal(cloudTunnelStatus.claimUrl!);
                    } else {
                      window.open(cloudTunnelStatus.claimUrl!, '_blank');
                    }
                  }}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold rounded text-[11px] cursor-pointer"
                >
                  Claim Address →
                </button>
              </div>
            ) : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress ? (
              <div className="flex flex-col gap-2 bg-amber-950/20 p-3 rounded-lg border border-amber-500/20 text-xs">
                <div className="flex items-center gap-2 text-amber-300">
                  <PlaceholderIcon className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">Action Required: Tunnel Missing</span>
                </div>
                <p className="text-slate-400">Your agent is linked but needs a Minecraft tunnel.</p>
                <button
                  onClick={() => {
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal('https://playit.gg/account/tunnels');
                    } else {
                      window.open('https://playit.gg/account/tunnels', '_blank');
                    }
                  }}
                  className="mt-1 px-3 py-2 leading-none bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold rounded-lg self-start transition-all shadow-sm shadow-amber-500/10 cursor-pointer"
                >
                  Create Tunnel →
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-obsidian-950/40 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                <span>Playit.gg tunnel is offline.</span>
                <button
                  onClick={() => startCloudTunnel(activeServer?.port || 25565)}
                  disabled={isLoadingNetwork}
                  className="flex items-center gap-1.5 px-3 py-2 leading-none bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold rounded-lg text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isLoadingNetwork ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Turn On</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Card 2: Bedrock & Mobile Cross-Play Connection Guide */}
        <div className="glass-card rounded-xl p-5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-white">Bedrock Server</h2>
                <p className="text-xs text-slate-400">Enter IP and Port to join</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center justify-between bg-obsidian-950/80 p-3 rounded-lg border border-white/10">
              <span className="font-mono text-xs text-white font-semibold select-all truncate">
                {bedrockIp}
              </span>
              <button
                onClick={() => handleCopy(bedrockIp, 'bedrock-ip')}
                className="text-slate-400 hover:text-white shrink-0"
                title="Copy IP"
              >
                {copiedKey === 'bedrock-ip' ? <Check className="w-3.5 h-3.5 text-slate-200" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="w-24 flex items-center justify-between bg-obsidian-950/80 p-3 rounded-lg border border-white/10">
              <span className="font-mono text-xs text-white font-semibold select-all truncate">
                {displayBedrockPort}
              </span>
              <button
                onClick={() => handleCopy(displayBedrockPort.toString(), 'bedrock-port')}
                className="text-slate-400 hover:text-white shrink-0"
                title="Copy Port"
              >
                {copiedKey === 'bedrock-port' ? <Check className="w-3.5 h-3.5 text-slate-200" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
