import React, { useState } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { Copy, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { PlayItIcon } from '../common/Icons';
import { useNetwork } from '../../context/NetworkContext';
import { useServer } from '../../context/ServerContext';
import { NetworkMode } from '../../types';

export const NetworkTab: React.FC = () => {
  const {
    upnpStatus,
    cloudTunnelStatus,
    isLanBroadcasting,
    localIp,
    publicIp,
    isLoadingNetwork,
    checkUpnpSupport,
    startUpnp,
    stopUpnp,
    startCloudTunnel,
    stopCloudTunnel,
    toggleLan,
    applyNetworkMode,
    refreshDiagnostics
  } = useNetwork();

  const { activeServer, updateServerConfig, status } = useServer();

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
          <div className="w-10 h-10 rounded-xl bg-white/5 text-slate-200 flex items-center justify-center border border-white/10">
            <PlaceholderIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Network & Multiplayer Sharing</h1>
            <p className="text-xs text-slate-400">
              Configure online sharing and router port forwarding for <strong className="text-white">{activeServer?.name || 'Your Server'}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            refreshDiagnostics();
            checkUpnpSupport(true);
          }}
          disabled={isLoadingNetwork}
          className="flex items-center gap-1.5 px-3 py-2 leading-none rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition border border-white/5"
        >
          <PlaceholderIcon className={`w-3.5 h-3.5 ${isLoadingNetwork ? 'animate-spin' : ''}`} />
          <span>Re-probe Network</span>
        </button>
      </div>

      {/* 3-Way Mode Switcher */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Select Multiplayer Connection Mode:
          </span>
          <span className="text-xs text-slate-400">
            Click a card to switch connection method
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Mode 1: PlayIt.gg Tunnel */}
          <button
            type="button"
            onClick={() => handleSwitchMode('cloud_relay')}
            className={`p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between ${
              currentMode === 'cloud_relay'
                ? 'bg-white/5 border-white/10 shadow-lg shadow-emerald-500/5'
                : 'bg-obsidian-900 border-white/5 hover:border-white/15'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center p-1 shrink-0">
                    <PlayItIcon className="w-8 h-8 rounded-lg" />
                  </div>
                  <strong className="text-xs font-bold text-white">PlayIt.gg Tunnel</strong>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-white border border-white/10">
                    Recommended
                  </span>
                  {currentMode === 'cloud_relay' && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500 text-obsidian-950">
                      Active
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Universal internet play. Bypasses CGNAT & strict firewalls with zero router port forwarding. Fast and easy setup.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-200 font-medium">
              <PlaceholderIcon className="w-3 h-3" />
              <span>Worldwide Play • Works Everywhere</span>
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
                ? 'bg-obsidian-950/60 border-red-500/20 opacity-75 cursor-not-allowed'
                : currentMode === 'upnp'
                ? 'bg-white/5 border-white/10 shadow-lg shadow-emerald-500/5 cursor-pointer'
                : 'bg-obsidian-900 border-white/5 hover:border-white/15 cursor-pointer'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    !upnpStatus.isSupported
                      ? 'bg-red-500/10 text-red-400'
                      : currentMode === 'upnp'
                      ? 'bg-emerald-500 text-obsidian-950'
                      : 'bg-white/5 text-slate-200'
                  }`}>
                    {upnpStatus.isSupported ? <PlaceholderIcon className="w-4 h-4" /> : <PlaceholderIcon className="w-4 h-4" />}
                  </div>
                  <strong className="text-xs font-bold text-white">Direct UPnP Port</strong>
                </div>
                <div className="flex items-center gap-1">
                  {upnpStatus.isSupported ? (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-white border border-white/10">
                      0ms Ping
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                      Unsupported
                    </span>
                  )}
                  {currentMode === 'upnp' && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500 text-obsidian-950">
                      Active
                    </span>
                  )}
                </div>
              </div>

              {upnpStatus.isSupported ? (
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Direct connection through your router. Provides the absolute lowest latency with no intermediary relays.
                </p>
              ) : (
                <div className="bg-red-950/40 border border-red-500/20 rounded-lg p-2.5 mb-3 text-[11px] text-red-300 leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <PlaceholderIcon className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span>
                      UPnP is unavailable or disabled on your current network gateway. Your router or ISP does not allow automatic port mapping. Please use PlayIt.gg Tunnel.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className={upnpStatus.isSupported ? 'text-slate-200 font-medium' : 'text-slate-400'}>
                {upnpStatus.isSupported ? (upnpStatus.routerName || 'Router Gateway Ready') : 'Gateway Incompatible'}
              </span>
              {!upnpStatus.isSupported && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    checkUpnpSupport(true);
                  }}
                  className="text-slate-200 hover:underline flex items-center gap-0.5 text-[10px]"
                >
                  <span>Re-test</span>
                  <PlaceholderIcon className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Mode 3: Only LAN */}
          <button
            type="button"
            onClick={() => handleSwitchMode('lan_only')}
            className={`p-4 rounded-xl text-left border transition-all relative flex flex-col justify-between ${
              currentMode === 'lan_only'
                ? 'bg-white/5 border-white/10 shadow-lg shadow-emerald-500/5'
                : 'bg-obsidian-900 border-white/5 hover:border-white/15'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${currentMode === 'lan_only' ? 'bg-emerald-500 text-obsidian-950' : 'bg-white/5 text-slate-300'}`}>
                    <PlaceholderIcon className="w-4 h-4" />
                  </div>
                  <strong className="text-xs font-bold text-white">Local LAN Only</strong>
                </div>
                {currentMode === 'lan_only' && (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500 text-obsidian-950">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                Offline local network play. Broadcasts the server directly to players connected to your home Wi-Fi.
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <PlaceholderIcon className="w-3 h-3" />
              <span>Offline • Local Network</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Engine Status & Controls */}
      {currentMode === 'cloud_relay' && (
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center p-1.5 shadow-md shrink-0">
                <PlayItIcon className="w-11 h-11 rounded-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">PlayIt.gg Tunnel</h2>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress
                      ? 'bg-white/5 text-white border-white/10'
                      : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : cloudTunnelStatus.status === 'WAITING_CLAIM'
                      ? 'bg-red-500/10 text-red-300 border-red-500/30'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    {cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress
                      ? 'Tunnel Active'
                      : cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress
                      ? 'Tunnel Missing'
                      : cloudTunnelStatus.status === 'WAITING_CLAIM'
                      ? 'Action Required'
                      : 'Disconnected'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Zero-configuration internet tunnel for worldwide multiplayer access.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (cloudTunnelStatus.isActive) {
                  stopCloudTunnel();
                } else {
                  startCloudTunnel(activePort);
                }
              }}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                cloudTunnelStatus.isActive
                  ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-obsidian-950'
              }`}
            >
              <PlaceholderIcon className={`w-3.5 h-3.5 ${cloudTunnelStatus.isActive ? 'animate-pulse' : ''}`} />
              <span>{cloudTunnelStatus.isActive ? 'Disconnect Tunnel' : 'Start PlayIt.gg Tunnel'}</span>
            </button>
          </div>

          {/* Connecting Progress State */}
          {cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'STARTING' && (
            <div className="bg-obsidian-900 rounded-xl p-5 border border-white/10 flex items-center gap-3.5">
              <PlaceholderIcon className="w-5 h-5 text-slate-200 animate-spin shrink-0" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white">Connecting to PlayIt.gg Tunnel Network...</div>
                <div className="text-[11px] text-slate-400">
                  Establishing encrypted tunnel session and resolving public Minecraft join address.
                </div>
              </div>
            </div>
          )}

          {/* First Time 1-Click Claim Prompt */}
          {cloudTunnelStatus.status === 'WAITING_CLAIM' && cloudTunnelStatus.claimUrl && (
            <div className="bg-obsidian-900 rounded-xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-wider">
                <PlaceholderIcon className="w-4 h-4 text-slate-200" />
                <span>One-Time Free Linking Required:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your browser has been opened automatically. Log into your PlayIt.gg account and click the{' '}
                <strong className="text-slate-200">"Claim Agent"</strong>{' '}
                button on the page. Craftora will detect it instantly.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleOpenClaimUrl}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold text-xs rounded-lg flex items-center gap-2 transition shadow-md cursor-pointer"
                >
                  <span>Re-open Claim Page in Browser</span>
                  <PlaceholderIcon className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 text-xs text-amber-300">
                  <PlaceholderIcon className="w-3.5 h-3.5 animate-spin" />
                  <span>Waiting for you to claim in browser...</span>
                </div>
              </div>
            </div>
          )}

          {/* Missing Tunnel Prompt */}
          {cloudTunnelStatus.isActive && cloudTunnelStatus.status === 'ONLINE' && !cloudTunnelStatus.serverAddress && (
            <div className="bg-amber-950/20 rounded-xl p-5 border border-amber-500/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                <PlaceholderIcon className="w-4 h-4 text-amber-400" />
                <span>Action Required: Tunnel Missing</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
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
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold rounded-lg text-xs transition shadow-md cursor-pointer"
              >
                <span>Create Tunnel on PlayIt.gg</span>
                <PlaceholderIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}


          {/* Live Public Join Address Card */}
          {cloudTunnelStatus.isActive && cloudTunnelStatus.serverAddress && (
            <div className="bg-obsidian-950/90 rounded-xl p-5 border border-white/10 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Public Join Address:
                </span>
                <span className="text-[11px] text-slate-400">Share this address with friends</span>
              </div>

              <div className="flex items-center justify-between bg-obsidian-850 p-3.5 rounded-lg border border-white/10">
                <span className="font-mono text-base font-bold text-white select-all">
                  {cloudTunnelStatus.serverAddress}
                </span>
                <button
                  onClick={() => handleCopy(cloudTunnelStatus.serverAddress!, 'cloud-address')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-500 text-obsidian-950 font-bold text-xs hover:bg-emerald-400 transition cursor-pointer"
                >
                  {copiedKey === 'cloud-address' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'cloud-address' ? 'Copied!' : 'Copy Address'}</span>
                </button>
              </div>
            </div>
          )}

          {cloudTunnelStatus.error && (
            <div className="bg-red-950/50 border border-red-500/30 p-3.5 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <PlaceholderIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{cloudTunnelStatus.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Direct UPnP View */}
      {currentMode === 'upnp' && (
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 text-slate-200 flex items-center justify-center border border-white/10">
                <PlaceholderIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">UPnP Router Port Forwarding</h2>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                    upnpStatus.isActive
                      ? 'bg-obsidian-950 text-white border-white/10'
                      : 'bg-white/5 text-slate-400 border-white/10'
                  }`}>
                    {upnpStatus.isActive ? 'Port Forwarded' : 'Port Closed'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Direct peer-to-peer connection through your router gateway ({upnpStatus.routerName || 'UPnP IGD'}).
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (upnpStatus.isActive) {
                  stopUpnp();
                } else {
                  startUpnp(activePort);
                }
              }}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                upnpStatus.isActive
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 shadow-lg shadow-emerald-500/20'
              }`}
            >
              <PlaceholderIcon className="w-3.5 h-3.5" />
              <span>{upnpStatus.isActive ? 'Release Port' : 'Open Router Port'}</span>
            </button>
          </div>

          {/* Live Direct IP Card */}
          {upnpStatus.isActive && (
            <div className="bg-obsidian-950/90 rounded-xl p-5 border border-white/10 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Direct Join Address:
                </span>
                <span className="text-[11px] text-slate-400">Direct Public IP (Zero-Lag)</span>
              </div>

              <div className="flex items-center justify-between bg-obsidian-850 p-3.5 rounded-lg border border-white/10">
                <span className="font-mono text-base font-bold text-white select-all">
                  {publicIp || upnpStatus.externalIp}:{activePort}
                </span>
                <button
                  onClick={() => handleCopy(`${publicIp || upnpStatus.externalIp}:${activePort}`, 'upnp-ip')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-500 text-obsidian-950 font-bold text-xs hover:bg-emerald-400 transition cursor-pointer"
                >
                  {copiedKey === 'upnp-ip' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'upnp-ip' ? 'Copied!' : 'Copy IP Address'}</span>
                </button>
              </div>
            </div>
          )}

          {upnpStatus.error && (
            <div className="bg-red-950/50 border border-red-500/30 p-3.5 rounded-xl text-xs text-red-300 flex items-start gap-2">
              <PlaceholderIcon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{upnpStatus.error}</span>
            </div>
          )}
        </div>
      )}

      {/* LAN Broadcast & Diagnostics Panel */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 text-slate-200 flex items-center justify-center border border-white/10">
              <PlaceholderIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Local LAN Multicast & Network Diagnostics</h3>
              <p className="text-xs text-slate-400">Detected IP configurations and local Wi-Fi broadcast</p>
            </div>
          </div>

          <button
            onClick={() => toggleLan(activeServer?.name)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              isLanBroadcasting
                ? 'bg-white/5 text-white border border-white/10'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            {isLanBroadcasting ? 'LAN Broadcasting Active' : 'Start LAN Broadcast'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-obsidian-950/60 p-3.5 rounded-xl border border-white/5 space-y-1 text-xs">
            <span className="text-slate-400">Local Wi-Fi IP:</span>
            <div className="font-mono text-slate-200 font-bold text-sm">{localIp}</div>
          </div>
          <div className="bg-obsidian-950/60 p-3.5 rounded-xl border border-white/5 space-y-1 text-xs">
            <span className="text-slate-400">Public Gateway IP:</span>
            <div className="font-mono text-slate-200 font-bold text-sm">{publicIp || 'Detecting...'}</div>
          </div>
          <div className="bg-obsidian-950/60 p-3.5 rounded-xl border border-white/5 space-y-1 text-xs">
            <span className="text-slate-400">Router UPnP Status:</span>
            <div className={`font-semibold text-xs flex items-center gap-1 ${upnpStatus.isSupported ? 'text-slate-200' : 'text-red-500'}`}>
              {upnpStatus.isSupported ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              <span>{upnpStatus.isSupported ? 'Supported' : 'Disabled / CGNAT'}</span>
            </div>
          </div>
          <div className="bg-obsidian-950/60 p-3.5 rounded-xl border border-white/5 space-y-1 text-xs">
            <span className="text-slate-400">Minecraft Port:</span>
            <div className="font-mono text-slate-200 font-bold text-sm">{activePort} (Java) / 19132 (Bedrock)</div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-obsidian-950 p-3 rounded-xl border border-white/5 text-xs">
          <span className="font-mono text-slate-300">{localIp}:{activePort}</span>
          <button
            onClick={() => handleCopy(`${localIp}:${activePort}`, 'lan-ip')}
            className="text-xs text-slate-200 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
          >
            {copiedKey === 'lan-ip' ? <Check className="w-3.5 h-3.5 text-slate-200" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'lan-ip' ? 'Copied' : 'Copy LAN IP'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
