import React, { useState } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { ProtectedIpDisplay } from '@/components/common/ProtectedIpDisplay';
import { GlassCard } from '@/components/common/GlassCard';
import { Badge } from '@/components/common/Badge';
import { Copy, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { PlayItIcon } from '../common/Icons';
import { useNetworkState, useNetworkActions } from '../../context/NetworkContext';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { NetworkMode } from '../../types';

export const NetworkTab: React.FC = () => {
  const { upnpStatus, cloudTunnelStatus, isLanBroadcasting, localIp, publicIp, isLoadingNetwork } = useNetworkState();
  const { checkUpnpSupport, startUpnp, stopUpnp, startCloudTunnel, stopCloudTunnel, toggleLan, applyNetworkMode, refreshDiagnostics } = useNetworkActions();

  const { activeServer, status } = useServerState();
  const { updateServerConfig } = useServerActions();

  const currentMode: NetworkMode = activeServer?.networkMode || 'cloud_relay';

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSwitchMode = async (mode: NetworkMode) => {
    if (!activeServer) return;
    if (mode === 'upnp' && !upnpStatus.isSupported) return;

    // 1. Update the server configuration in state/disk
    await updateServerConfig(activeServer.id, { networkMode: mode });

    // 2. Only switch live tunnels if the server is ALREADY actively running
    if (status === 'ONLINE' || status === 'STARTING') {
      await applyNetworkMode(mode, activeServer.name, activeServer.port);
    } else {
      // Server is stopped: gracefully shut down any previous active tunnels, but DO NOT start the new mode's tunnel
      if (mode !== 'cloud_relay' && cloudTunnelStatus.isActive) {
        await stopCloudTunnel();
      }
      if (mode !== 'upnp' && upnpStatus.isActive) {
        await stopUpnp();
      }
      if (mode !== 'lan_only' && isLanBroadcasting && window.electronAPI) {
        await window.electronAPI.stopLanBroadcast();
      }
    }
  };

  const handleOpenClaimUrl = () => {
    if (cloudTunnelStatus.claimUrl) {
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(cloudTunnelStatus.claimUrl);
      } else {
        window.open(cloudTunnelStatus.claimUrl, '_blank');
      }
    }
  };

  const activePort = activeServer?.port || 25565;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-content-primary">Multiplayer Settings</h1>
          </div>
        </div>
      </div>

      {/* 3-Way Mode Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-content-primary">
            Select Connection Mode:
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode 1: PlayIt.gg Tunnel */}
          <button
            type="button"
            onClick={() => handleSwitchMode('cloud_relay')}
            className={`p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between ${
              currentMode === 'cloud_relay'
                ? 'bg-surface-elevated border-border-default shadow-lg shadow-success-fg/5'
                : 'bg-surface-card border-border-subtle hover:bg-surface-hover hover:border-border-default'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <strong className="text-xs font-bold text-content-primary">PlayIt.gg Tunnel</strong>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="warning">
                    Recommended
                  </Badge>
                  {currentMode === 'cloud_relay' && (
                    <Badge variant="success">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-xs text-content-secondary leading-relaxed mb-3">
                Universal internet play. Bypasses CGNAT & strict firewalls with zero router port forwarding. Fast and easy setup.
              </p>
            </div>

          </button>

          {/* Mode 2: Direct UPnP (Router Port Mapping) */}
          <div
            onClick={() => {
              if (upnpStatus.isSupported) {
                handleSwitchMode('upnp');
              }
            }}
            className={`p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between ${
              !upnpStatus.isSupported
                ? 'bg-surface-card border-border-subtle cursor-not-allowed'
                : currentMode === 'upnp'
                ? 'bg-surface-elevated border-border-default shadow-lg shadow-success-fg/5 cursor-pointer'
                : 'bg-surface-card border-border-subtle hover:bg-surface-hover hover:border-border-default cursor-pointer'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <strong className="text-xs font-bold text-content-primary">Direct UPnP Port</strong>
                </div>
                <div className="flex items-center gap-1">
                  {upnpStatus.isSupported ? (
                    <Badge variant="neutral">
                      0ms Ping
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      Unsupported
                    </Badge>
                  )}
                  {currentMode === 'upnp' && (
                    <Badge variant="success">
                      Active
                    </Badge>
                  )}
                </div>
              </div>

              {upnpStatus.isSupported ? (
                <p className="text-xs text-content-secondary leading-relaxed mb-3">
                  Direct connection through your router. Provides the absolute lowest latency with no intermediary relays.
                </p>
              ) : (
                <div className="bg-warning-bg border border-warning-fg/20 rounded-lg p-2.5 mb-3 text-[11px] text-warning-fg leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <span>
                      UPnP is unavailable or disabled on your current network gateway. Your router or ISP does not allow automatic port mapping. Please use PlayIt.gg Tunnel.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!upnpStatus.isSupported && (
              <div className="flex justify-center mt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    checkUpnpSupport(true);
                  }}
                  className="px-4 py-1.5 bg-success hover:bg-success/80 text-surface-base font-medium rounded-lg text-xs transition"
                >
                  Re-test
                </button>
              </div>
            )}
          </div>

          {/* Mode 3: Only LAN */}
          <button
            type="button"
            onClick={() => handleSwitchMode('lan_only')}
            className={`p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between ${
              currentMode === 'lan_only'
                ? 'bg-surface-elevated border-border-default shadow-lg shadow-success-fg/5'
                : 'bg-surface-card border-border-subtle hover:bg-surface-hover hover:border-border-default'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <strong className="text-xs font-bold text-content-primary">Local LAN Only</strong>
                </div>
                {currentMode === 'lan_only' && (
                  <Badge variant="success">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-xs text-content-secondary leading-relaxed mb-3">
                Offline local network play. Broadcasts the server directly to players connected to your home Wi-Fi.
              </p>
            </div>

          </button>
        </div>
      </div>

      {/* Main Engine Status & Controls */}
      {currentMode === 'cloud_relay' && (
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-border-default flex items-center justify-center p-1.5 shadow-md shrink-0">
                <PlayItIcon className="w-11 h-11 rounded-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-content-primary">PlayIt.gg Tunnel</h2>
                  <Badge
                    variant={
                      cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress
                        ? 'success'
                        : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress
                        ? 'warning'
                        : cloudTunnelStatus.status === 'WAITING_CLAIM'
                        ? 'warning'
                        : 'warning'
                    }
                  >
                    {cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress
                      ? 'Tunnel Active'
                      : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress
                      ? 'Tunnel Missing'
                      : cloudTunnelStatus.status === 'WAITING_CLAIM'
                      ? 'Action Required'
                      : 'Disconnected'}
                  </Badge>
                </div>
                <p className="text-xs text-content-secondary">
                  Zero-configuration internet tunnel for worldwide multiplayer access.
                </p>
              </div>
            </div>
          </div>

          {/* Connecting Progress State */}
          {cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'STARTING' && (
            <div className="bg-surface-elevated rounded-xl p-5 border border-border-default flex items-center gap-3.5">
              <PlaceholderIcon className="w-5 h-5 text-content-primary animate-spin shrink-0" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-content-primary">Connecting to PlayIt.gg Tunnel Network...</div>
                <div className="text-[11px] text-content-secondary">
                  Establishing encrypted tunnel session and resolving public Minecraft join address.
                </div>
              </div>
            </div>
          )}

          {/* First Time 1-Click Claim Prompt */}
          {cloudTunnelStatus.status === 'WAITING_CLAIM' && cloudTunnelStatus.claimUrl && (
            <div className="bg-surface-elevated rounded-xl p-5 border border-border-default space-y-3">
              <div className="flex items-center gap-2 text-content-primary text-xs font-bold uppercase tracking-wider">
                <PlaceholderIcon className="w-4 h-4 text-content-primary" />
                <span>One-Time Free Linking Required:</span>
              </div>
              <p className="text-xs text-content-secondary leading-relaxed">
                Your browser has been opened automatically. Log into your PlayIt.gg account and click the{' '}
                <strong className="text-content-primary">"Claim Agent"</strong>{' '}
                button on the page. CraftTogether will detect it instantly.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleOpenClaimUrl}
                  className="px-4 py-2 bg-success hover:bg-success/80 text-surface-base font-bold text-xs rounded-lg flex items-center gap-2 transition shadow-md cursor-pointer"
                >
                  <span>Re-open Claim Page in Browser</span>
                  <PlaceholderIcon className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 text-xs text-warning-fg">
                  <PlaceholderIcon className="w-3.5 h-3.5 animate-spin" />
                  <span>Waiting for you to claim in browser...</span>
                </div>
              </div>
            </div>
          )}

          {/* Missing Tunnel Prompt */}
          {cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress && (
            <div className="bg-warning-bg rounded-xl p-5 border border-warning-fg/20 space-y-3">
              <div className="flex items-center gap-2 text-warning-fg text-xs font-bold uppercase tracking-wider">
                <PlaceholderIcon className="w-4 h-4 text-warning-fg" />
                <span>Action Required: Tunnel Missing</span>
              </div>
              <p className="text-xs text-content-secondary leading-relaxed">
                Your agent is linked and authenticated, but it has no Minecraft Java tunnel assigned to it.
              </p>
              <button
                onClick={() => {
                  if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal('https://playit.gg/account/tunnels');
                  } else {
                    window.open('https://playit.gg/account/tunnels', '_blank');
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-warning hover:bg-warning/80 text-surface-base font-bold rounded-lg text-xs transition shadow-md cursor-pointer"
              >
                <span>Create Tunnel on PlayIt.gg</span>
                <PlaceholderIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}


          {/* Live Public Join Address Card */}
          {cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress && (
            <div className="bg-surface-base/90 rounded-xl p-5 border border-border-default space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-success-fg animate-ping" />
                  Live Public Join Address:
                </span>
                <span className="text-[11px] text-content-secondary">Share this address with friends</span>
              </div>

              <div className="flex items-center justify-between bg-surface-card p-3.5 rounded-lg border border-border-default">
                <ProtectedIpDisplay 
                  ip={cloudTunnelStatus.serverAddress}
                  className="font-mono text-base font-bold text-content-primary select-all"
                />
                <button
                  onClick={() => handleCopy(cloudTunnelStatus.serverAddress!, 'cloud-address')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-success hover:bg-success/80 text-surface-base font-bold text-xs transition cursor-pointer"
                >
                  {copiedKey === 'cloud-address' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cloud-address' ? 'Copied!' : 'Copy Address'}</span>
                </button>
              </div>
            </div>
          )}

          {cloudTunnelStatus.error && (
            <div className="bg-danger-bg border border-danger-fg/20 p-3.5 rounded-xl text-xs text-danger-fg flex items-start gap-2">
              <PlaceholderIcon className="w-4 h-4 text-danger-fg shrink-0 mt-0.5" />
              <span>{cloudTunnelStatus.error}</span>
            </div>
          )}
        </GlassCard>
      )}

      {/* Mode 2: Direct UPnP View */}
      {currentMode === 'upnp' && (
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-elevated text-content-primary flex items-center justify-center border border-border-default">
                <PlaceholderIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-content-primary">UPnP Router Port Forwarding</h2>
                  <Badge variant={upnpStatus.isActive ? 'success' : 'neutral'}>
                    {upnpStatus.isActive ? 'Port Forwarded' : 'Port Closed'}
                  </Badge>
                </div>
                <p className="text-xs text-content-secondary">
                  Direct peer-to-peer connection through your router gateway ({upnpStatus.routerName || 'UPnP IGD'}).
                </p>
              </div>
            </div>
          </div>

          {/* Live Direct IP Card */}
          {upnpStatus.isActive && (
            <div className="bg-surface-base/90 rounded-xl p-5 border border-border-default space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-success-fg animate-ping" />
                  Live Direct Join Address:
                </span>
                <span className="text-[11px] text-content-secondary">Direct Public IP (Zero-Lag)</span>
              </div>

              <div className="flex items-center justify-between bg-surface-card p-3.5 rounded-lg border border-border-default">
                <ProtectedIpDisplay 
                  ip={`${publicIp || upnpStatus.externalIp || 'Unknown'}:${activePort}`}
                  className="font-mono text-base font-bold text-content-primary select-all"
                />
                <button
                  onClick={() => handleCopy(`${publicIp || upnpStatus.externalIp}:${activePort}`, 'upnp-ip')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-success text-surface-base font-bold text-xs hover:bg-success/80 transition cursor-pointer"
                >
                  {copiedKey === 'upnp-ip' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'upnp-ip' ? 'Copied!' : 'Copy IP Address'}</span>
                </button>
              </div>
            </div>
          )}

          {upnpStatus.error && (
            <div className="bg-danger-bg border border-danger-fg/20 p-3.5 rounded-xl text-xs text-danger-fg flex items-start gap-2">
              <PlaceholderIcon className="w-4 h-4 text-danger-fg shrink-0 mt-0.5" />
              <span>{upnpStatus.error}</span>
            </div>
          )}
        </GlassCard>
      )}

      {/* LAN Broadcast & Diagnostics Panel */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-content-primary">Networking</h3>
              <p className="text-xs text-content-secondary">Detected IP configurations and local Wi-Fi broadcast</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-surface-base/60 p-3.5 rounded-xl border border-border-subtle space-y-1 text-xs">
            <span className="text-xs font-bold text-content-primary block mb-1">Local Wi-Fi IP</span>
            <ProtectedIpDisplay ip={localIp} className="font-mono text-content-primary font-bold text-sm" />
          </div>
          <div className="bg-surface-base/60 p-3.5 rounded-xl border border-border-subtle space-y-1 text-xs">
            <span className="text-xs font-bold text-content-primary block mb-1">Public Gateway IP</span>
            <ProtectedIpDisplay ip={publicIp || 'Detecting...'} className="font-mono text-content-primary font-bold text-sm" />
          </div>
          <div className="bg-surface-base/60 p-3.5 rounded-xl border border-border-subtle space-y-1 text-xs">
            <span className="text-xs font-bold text-content-primary block mb-1">Router UPnP Status</span>
            <div className={`font-semibold text-xs flex items-center gap-1 ${upnpStatus.isSupported ? 'text-content-primary' : 'text-warning-fg'}`}>
              {upnpStatus.isSupported ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{upnpStatus.isSupported ? 'Supported' : 'Disabled / CGNAT'}</span>
            </div>
          </div>
          <div className="bg-surface-base/60 p-3.5 rounded-xl border border-border-subtle space-y-1 text-xs">
            <span className="text-xs font-bold text-content-primary block mb-1">Minecraft Port</span>
            <div className="font-mono text-content-primary font-bold text-sm">{activePort} (Java) / 19132 (Bedrock)</div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-surface-base p-3 rounded-xl border border-border-subtle text-xs">
          <ProtectedIpDisplay ip={`${localIp}:${activePort}`} className="font-mono text-content-primary font-bold text-sm" />
          <button
            onClick={() => handleCopy(`${localIp}:${activePort}`, 'lan-ip')}
            className="text-content-secondary hover:text-content-primary shrink-0 transition cursor-pointer"
            title="Copy IP"
          >
            {copiedKey === 'lan-ip' ? <Check className="w-3.5 h-3.5 text-content-primary" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};
