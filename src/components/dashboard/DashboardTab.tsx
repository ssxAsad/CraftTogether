import React, { useState, useEffect, useRef } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { ProtectedIpDisplay } from '@/components/common/ProtectedIpDisplay';
import { GlassCard } from '@/components/common/GlassCard';
import { Badge } from '@/components/common/Badge';
import { Play, Square, RotateCw, X, Copy, Check } from 'lucide-react';
import { PlayItIcon } from '../common/Icons';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { useNetworkState, useNetworkActions } from '../../context/NetworkContext';
import confetti from 'canvas-confetti';

interface DashboardTabProps {
  onNavigateTab: (tab: any) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ onNavigateTab }) => {
  const { activeServer, status, metrics, players } = useServerState();
  const { startServer, stopServer, killServer } = useServerActions();
  const { cloudTunnelStatus, upnpStatus, localIp, publicIp, isLoadingNetwork } = useNetworkState();
  const { startCloudTunnel, stopCloudTunnel, startUpnp, stopUpnp } = useNetworkActions();
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
      <div className="rounded-xl bg-surface-elevated p-6 border border-border-default shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Server identity & state */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-content-primary tracking-tight">
                {activeServer?.name || 'Craftora Server'}
              </h1>
              <Badge variant="warning">
                {activeServer?.serverSoftware.toUpperCase()} {activeServer?.version}
              </Badge>

            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-content-secondary">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Uptime: <strong className="text-content-primary font-mono">{formatUptime(metrics.uptimeSeconds)}</strong>
              </span>
              {activeServer?.isCracked && (
                <Badge variant="warning">
                  Cracked Enabled
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {status === 'STOPPED' || status === 'CRASHED' ? (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-success hover:bg-success/80 text-white font-bold text-xs shadow-sm transition active:translate-y-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Server</span>
              </button>
            ) : status === 'STARTING' ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-bg text-content-secondary border border-border-default font-bold text-xs animate-pulse cursor-not-allowed"
              >
                <RotateCw className="w-4 h-4 animate-spin text-content-primary" />
                <span>Starting Up...</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={stopServer}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-danger hover:bg-danger/80 text-white font-bold text-xs transition border-transparent"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop</span>
                </button>
                <button
                  onClick={killServer}
                  title="Force Kill (Emergency)"
                  className="p-2.5 rounded-lg bg-surface-hover hover:bg-danger text-content-secondary hover:text-white border border-border-default hover:border-transparent transition"
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
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between text-content-secondary text-xs">
            <span className="font-semibold uppercase tracking-wider">CPU Usage</span>
          </div>
          <div className="text-2xl font-black text-content-primary font-mono">
            {metrics.cpu}%
          </div>
            {/* Progress bar */}
          <div className="w-full h-1.5 bg-surface-card rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                metrics.cpu > 80 ? 'bg-danger' : 'bg-success'
              }`}
              style={{ width: `${Math.min(metrics.cpu, 100)}%` }}
            />
          </div>
        </GlassCard>

        {/* RAM Usage */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between text-content-secondary text-xs">
            <span className="font-semibold uppercase tracking-wider">RAM Usage</span>
          </div>
          <div className="text-2xl font-black text-content-primary font-mono">
            {metrics.memoryMb} <span className="text-xs text-content-secondary font-sans font-normal">/ {ramMaxMb} MB</span>
          </div>
          <div className="w-full h-1.5 bg-surface-card rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                ramPercent > 85 ? 'bg-danger' : 'bg-success'
              }`}
              style={{ width: `${ramPercent}%` }}
            />
          </div>
        </GlassCard>

        {/* TPS (Ticks Per Second) */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between text-content-secondary text-xs">
            <span className="font-semibold uppercase tracking-wider">Server TPS</span>
          </div>
          <div className="text-2xl font-black text-content-primary font-mono flex items-center gap-2">
            {status === 'ONLINE' ? metrics.tps.toFixed(1) : '--'}
            <span className="text-xs text-content-secondary font-sans font-medium">
              {status === 'ONLINE' ? 'Optimal (20.0)' : 'Idle'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-card rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-500"
              style={{ width: status === 'ONLINE' ? '100%' : '0%' }}
            />
          </div>
        </GlassCard>

        {/* Online Players */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center justify-between text-content-secondary text-xs">
            <span className="font-semibold uppercase tracking-wider">Players</span>
          </div>
          <div className="text-2xl font-black text-content-primary font-mono flex items-center justify-between">
            <span>{players.length} <span className="text-xs text-content-secondary font-sans font-normal">/ {metrics.maxPlayers}</span></span>
            <button
              onClick={() => onNavigateTab('players')}
              className="px-3 py-1 bg-success hover:bg-success/80 text-white font-bold rounded-lg text-xs transition border-transparent font-sans"
            >
              View
            </button>
          </div>
          <div className="w-full h-1.5 bg-surface-card rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-500"
              style={{ width: `${(players.length / metrics.maxPlayers) * 100}%` }}
            />
          </div>
        </GlassCard>
      </div>

      {/* Quick Join Addresses & Connectivity Widget based on active server's networkMode */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Internet / Public Access (Cloud Relay / UPnP) or Local Access (LAN) */}
        {activeServer?.networkMode === 'lan_only' ? (
          <GlassCard className="p-5 border-border-default space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div>
                  <h2 className="text-sm font-bold text-content-primary">For Java Clients</h2>
                  <p className="text-xs text-content-secondary">Copy and paste the IP given below:</p>
                </div>
              </div>
              <Badge variant="warning">
                LAN
              </Badge>
            </div>

            <div className="flex items-center justify-between bg-surface-base/80 p-3 rounded-lg border border-border-default">
              <ProtectedIpDisplay 
                ip={`${localIp}:${activeServer?.port || 25565}`}
                className="font-mono text-xs text-content-primary font-semibold select-all truncate"
              />
              <button
                onClick={() => handleCopy(`${localIp}:${activeServer?.port || 25565}`, 'lan-only-ip')}
                className="text-content-secondary hover:text-content-primary shrink-0"
                title="Copy IP"
              >
                {copiedKey === 'lan-only-ip' ? <Check className="w-3.5 h-3.5 text-content-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </GlassCard>
        ) : null}
        {activeServer?.networkMode !== 'lan_only' && (
          <GlassCard className="p-5 border-border-default space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-sm font-bold text-content-primary">
                    {activeServer?.networkMode === 'upnp' ? 'Direct UPnP IP' : 'PlayIt.gg Tunnel'}
                  </h2>
                  <p className="text-xs text-content-secondary">Share with friends over the internet</p>
                </div>
              </div>
            </div>

            {activeServer?.networkMode === 'upnp' ? (
              upnpStatus.isActive ? (
                <div className="flex items-center justify-between bg-surface-base/80 p-3 rounded-lg border border-border-default">
                  <ProtectedIpDisplay 
                    ip={`${publicIp || upnpStatus.externalIp || 'Unknown'}:${activeServer.port || 25565}`}
                    className="font-mono text-xs text-content-primary font-semibold select-all truncate"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(`${publicIp || upnpStatus.externalIp}:${activeServer.port || 25565}`, 'upnp-ip')}
                      className="flex items-center justify-center w-7 h-7 bg-neutral-bg text-content-primary hover:bg-surface-hover rounded transition cursor-pointer"
                    >
                      {copiedKey === 'upnp-ip' ? <Check className="w-3.5 h-3.5 text-content-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-content-secondary bg-surface-base/40 p-3 rounded-lg border border-border-subtle flex items-center justify-between">
                  <span>UPnP port forwarding is offline.</span>
                </div>
              )
            ) : cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress ? (
              <div className="flex items-center justify-between bg-surface-base/80 p-3 rounded-lg border border-border-default">
                <ProtectedIpDisplay 
                  ip={cloudTunnelStatus.serverAddress.split(':')[0]}
                  className="font-mono text-xs text-content-primary font-semibold select-all truncate"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(cloudTunnelStatus.serverAddress!.split(':')[0], 'cloud')}
                    className="flex items-center justify-center w-7 h-7 bg-neutral-bg text-content-primary hover:bg-surface-hover rounded transition cursor-pointer"
                  >
                    {copiedKey === 'cloud' ? <Check className="w-3.5 h-3.5 text-content-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'STARTING' ? (
              <div className="flex items-center justify-between bg-surface-elevated p-3 rounded-lg border border-border-default text-xs text-content-primary">
                <div className="flex items-center gap-2">
                  <PlaceholderIcon className="w-4 h-4 animate-spin text-content-primary shrink-0" />
                  <span>Connecting to Playit.gg tunnel...</span>
                </div>
                <button
                  onClick={() => stopCloudTunnel()}
                  className="px-2.5 py-1 text-xs font-semibold bg-danger hover:bg-danger/80 text-white rounded transition cursor-pointer border-transparent"
                >
                  Cancel
                </button>
              </div>
            ) : cloudTunnelStatus.status === 'WAITING_CLAIM' && cloudTunnelStatus.claimUrl ? (
              <div className="flex items-center justify-between bg-surface-elevated p-3 rounded-lg border border-border-default text-xs text-content-primary">
                <div className="flex items-center gap-2">
                  <PlaceholderIcon className="w-4 h-4 text-content-primary shrink-0" />
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
                  className="px-3 py-1 bg-success hover:bg-success/80 text-white font-bold rounded text-[11px] cursor-pointer"
                >
                  Claim Address →
                </button>
              </div>
            ) : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress ? (
              <div className="flex flex-col gap-2 bg-warning-bg p-3 rounded-lg border border-warning-fg/20 text-xs">
                <div className="flex items-center gap-2 text-warning-fg">
                  <PlaceholderIcon className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">Action Required: Tunnel Missing</span>
                </div>
                <p className="text-content-secondary">Your agent is linked but needs a Minecraft tunnel.</p>
                <button
                  onClick={() => {
                    if (window.electronAPI?.openExternal) {
                      window.electronAPI.openExternal('https://playit.gg/account/tunnels');
                    } else {
                      window.open('https://playit.gg/account/tunnels', '_blank');
                    }
                  }}
                  className="mt-1 px-3 py-2 leading-none bg-warning hover:bg-warning/80 text-white font-bold rounded-lg self-start transition-all shadow-sm shadow-warning-fg/10 cursor-pointer"
                >
                  Create Tunnel →
                </button>
              </div>
            ) : (
              <div className="text-xs text-content-secondary bg-surface-base/40 p-3 rounded-lg border border-border-subtle flex items-center justify-between">
                <span>Playit.gg tunnel is offline.</span>
              </div>
            )}
          </GlassCard>
        )}

        {/* Card 2: Bedrock & Mobile Cross-Play Connection Guide */}
        <GlassCard className="p-5 border-border-default space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-sm font-bold text-content-primary">For Bedrock Clients</h2>
                <p className="text-xs text-content-secondary">Enter IP and Port given below:</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center justify-between bg-surface-base/80 p-3 rounded-lg border border-border-default">
              <ProtectedIpDisplay 
                ip={bedrockIp}
                className="font-mono text-xs text-content-primary font-semibold select-all truncate"
              />
              <button
                onClick={() => handleCopy(bedrockIp, 'bedrock-ip')}
                className="text-content-secondary hover:text-content-primary shrink-0"
                title="Copy IP"
              >
                {copiedKey === 'bedrock-ip' ? <Check className="w-3.5 h-3.5 text-content-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="w-24 flex items-center justify-between bg-surface-base/80 p-3 rounded-lg border border-border-default">
              <span className="font-mono text-xs text-content-primary font-semibold select-all truncate">
                {displayBedrockPort}
              </span>
              <button
                onClick={() => handleCopy(displayBedrockPort.toString(), 'bedrock-port')}
                className="text-content-secondary hover:text-content-primary shrink-0"
                title="Copy Port"
              >
                {copiedKey === 'bedrock-port' ? <Check className="w-3.5 h-3.5 text-content-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
