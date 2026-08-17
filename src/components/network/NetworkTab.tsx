import React, { useState } from 'react';
import {
  Globe2,
  Wifi,
  Radio,
  Copy,
  Check,
  Key,
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';
import { useNetwork } from '../../context/NetworkContext';
import { useServer } from '../../context/ServerContext';
import { NetworkMode } from '../../types';

export const NetworkTab: React.FC = () => {
  const {
    ngrokStatus,
    isLanBroadcasting,
    localIp,
    publicIp,
    isLoadingNetwork,
    startNgrok,
    stopNgrok,
    saveNgrokToken,
    toggleLan,
    applyNetworkMode,
    refreshDiagnostics
  } = useNetwork();
  const { activeServer, updateServerConfig } = useServer();

  const currentMode: NetworkMode = activeServer?.networkMode || 'ngrok_lan';
  const [tokenInput, setTokenInput] = useState(ngrokStatus.authToken || '');
  const [showToken, setShowToken] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;
    await saveNgrokToken(tokenInput.trim());
  };

  const handleToggleNgrok = async () => {
    if (ngrokStatus.isActive) {
      await stopNgrok();
    } else {
      await startNgrok(tokenInput);
    }
  };

  const handleSwitchMode = async (mode: NetworkMode) => {
    if (!activeServer) return;
    await updateServerConfig(activeServer.id, { networkMode: mode });
    await applyNetworkMode(mode, activeServer.name, activeServer.port);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Network & Multiplayer Sharing</h1>
            <p className="text-xs text-slate-400">
              Configure and switch connection modes for <strong className="text-white">{activeServer?.name}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={refreshDiagnostics}
          disabled={isLoadingNetwork}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingNetwork ? 'animate-spin' : ''}`} />
          <span>Refresh IPs</span>
        </button>
      </div>

      {/* 2-Way Mode Switcher for Active Server */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Connection Mode:
          </span>
          <span className="text-xs text-slate-400">
            Click to switch mode for this server
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode 1: Ngrok + LAN */}
          <button
            type="button"
            onClick={() => handleSwitchMode('ngrok_lan')}
            className={`p-4 rounded-xl text-left border transition-all relative ${
              currentMode === 'ngrok_lan'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-obsidian-900 border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${currentMode === 'ngrok_lan' ? 'bg-emerald-500 text-obsidian-950' : 'bg-white/5 text-emerald-400'}`}>
                  <Globe2 className="w-4 h-4" />
                </div>
                <strong className="text-xs font-bold text-white">Ngrok + LAN</strong>
              </div>
              {currentMode === 'ngrok_lan' && (
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500 text-obsidian-950">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-tight">
              Play online with friends anywhere over the internet. Zero router configuration required.
            </p>
          </button>

          {/* Mode 2: Only LAN */}
          <button
            type="button"
            onClick={() => handleSwitchMode('lan_only')}
            className={`p-4 rounded-xl text-left border transition-all relative ${
              currentMode === 'lan_only'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-obsidian-900 border-white/5 hover:border-white/15'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${currentMode === 'lan_only' ? 'bg-emerald-500 text-obsidian-950' : 'bg-white/5 text-slate-400'}`}>
                  <Radio className="w-4 h-4" />
                </div>
                <strong className="text-xs font-bold text-white">Only LAN</strong>
              </div>
              {currentMode === 'lan_only' && (
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500 text-obsidian-950">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-tight">
              Offline local network play for friends connected to your same Wi-Fi.
            </p>
          </button>
        </div>
      </div>

      {/* Mode 1: Free ngrok TCP Tunnel */}
      <div className="glass-card rounded-xl p-6 border border-white/10 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Ngrok Internet Tunnel</h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  Internet Play
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Securely stream and share your server with friends across the world.
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleNgrok}
            className={`px-5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
              ngrokStatus.isActive
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                : 'bg-emerald-500 hover:bg-emerald-600 text-obsidian-950'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${ngrokStatus.isActive ? 'animate-pulse' : ''}`} />
            <span>{ngrokStatus.isActive ? 'Disconnect Tunnel' : 'Start ngrok Tunnel'}</span>
          </button>
        </div>

        {/* Public Shareable Box if Active */}
        {ngrokStatus.isActive && ngrokStatus.serverAddress && (
          <div className="bg-obsidian-950/90 rounded-xl p-4 border border-cyan-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Live Public Join Address:
              </span>
              <span className="text-[11px] text-slate-400">Give this address to friends</span>
            </div>

            <div className="flex items-center justify-between bg-obsidian-850 p-3 rounded-lg border border-white/5">
              <span className="font-mono text-sm font-bold text-white select-all">
                {ngrokStatus.serverAddress}
              </span>
              <button
                onClick={() => handleCopy(ngrokStatus.serverAddress!, 'ngrok-full')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500 text-obsidian-950 font-bold text-xs hover:bg-cyan-400 transition"
              >
                {copiedKey === 'ngrok-full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'ngrok-full' ? 'Copied!' : 'Copy Address'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error notice if any */}
        {ngrokStatus.error && (
          <div className="bg-red-950/50 border border-red-500/30 p-3 rounded-xl text-xs text-red-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{ngrokStatus.error}</span>
          </div>
        )}

        {/* AuthToken input configuration */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>ngrok Authtoken</span>
            </label>
            <button
              type="button"
              onClick={() => {
                const url = 'https://dashboard.ngrok.com/get-started/your-authtoken';
                if (window.electronAPI?.openExternal) {
                  window.electronAPI.openExternal(url);
                } else {
                  window.open(url, '_blank');
                }
              }}
              className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
            >
              <span>Get Free Token</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste your free ngrok Authtoken (e.g. 2sXYZ...)"
              className="flex-1 px-3 py-2 bg-obsidian-950/80 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-300 font-medium"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={handleSaveToken}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition"
            >
              Save Token
            </button>
          </div>
        </div>
      </div>

      {/* Mode 2: Native LAN Discovery & Multicast */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Local LAN Multicast & Discovery</h3>
              <p className="text-xs text-slate-400">Automatically broadcasts server to players on your home Wi-Fi</p>
            </div>
          </div>

          <button
            onClick={() => toggleLan(activeServer?.name)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              isLanBroadcasting
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-white/10 text-slate-300 hover:bg-white/20'
            }`}
          >
            {isLanBroadcasting ? 'Broadcasting' : 'Start LAN'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-obsidian-950/60 p-3 rounded-xl border border-white/5 space-y-1 text-xs">
            <span className="text-slate-400">Local Wi-Fi IP:</span>
            <div className="font-mono text-violet-300 font-bold text-sm">{localIp}</div>
          </div>
          <div className="bg-obsidian-950/60 p-3 rounded-xl border border-white/5 space-y-1 text-xs">
            <span className="text-slate-400">Java LAN Port:</span>
            <div className="font-mono text-emerald-400 font-bold text-sm">{activeServer?.port || 25565}</div>
          </div>
          <div className="bg-obsidian-950/60 p-3 rounded-xl border border-white/5 space-y-1 text-xs">
            <span className="text-slate-400">Bedrock LAN Port:</span>
            <div className="font-mono text-cyan-400 font-bold text-sm">19132</div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-obsidian-950 p-3 rounded-lg border border-white/5 text-xs">
          <span className="font-mono text-slate-300 font-medium">{localIp}:{activeServer?.port || 25565}</span>
          <button
            onClick={() => handleCopy(`${localIp}:${activeServer?.port || 25565}`, 'lan-ip')}
            className="text-xs text-violet-400 hover:underline flex items-center gap-1 font-semibold"
          >
            {copiedKey === 'lan-ip' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'lan-ip' ? 'Copied' : 'Copy LAN IP'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
