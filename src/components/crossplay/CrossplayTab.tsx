import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Save,
  HelpCircle,
  ShieldCheck,
  Globe,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useDialog } from '../../context/DialogContext';
import { GeyserConfig } from '../../types';

export const CrossplayTab: React.FC = () => {
  const { activeServer } = useServer();
  const { showAlert } = useDialog();
  const [isInstalled, setIsInstalled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [geyserConfig, setGeyserConfig] = useState<GeyserConfig>({
    bedrockPort: 19132,
    bedrockAddress: '0.0.0.0',
    authType: 'floodgate',
    motd1: 'DukeCraftora Bedrock Server',
    motd2: 'Java + Bedrock Cross-Play',
    passthroughMotd: true,
    passthroughMaxPlayers: true
  });

  const checkGeyser = async () => {
    if (!activeServer) return;
    if (window.electronAPI) {
      const installed = await window.electronAPI.isGeyserInstalled(activeServer.id);
      setIsInstalled(installed);
      if (installed) {
        const config = await window.electronAPI.getGeyserConfig(activeServer.id);
        setGeyserConfig(config);
      }
    } else {
      setIsInstalled(true);
    }
  };

  useEffect(() => {
    checkGeyser();
  }, [activeServer]);

  const handleInstall = async () => {
    if (!activeServer) return;
    setLoading(true);
    if (window.electronAPI) {
      await window.electronAPI.installGeyser(activeServer.id);
      await checkGeyser();
    } else {
      setIsInstalled(true);
    }
    setLoading(false);
  };

  const handleUninstall = async () => {
    if (!activeServer) return;
    setLoading(true);
    if (window.electronAPI) {
      await window.electronAPI.removeGeyser(activeServer.id);
      setIsInstalled(false);
    } else {
      setIsInstalled(false);
    }
    setLoading(false);
  };

  const handleSaveConfig = async () => {
    if (!activeServer) return;
    if (window.electronAPI) {
      await window.electronAPI.saveGeyserConfig({
        serverId: activeServer.id,
        config: geyserConfig
      });
    }
    await showAlert('GeyserMC Configuration', 'Geyser configuration saved and synchronized successfully!', 'success');
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">GeyserMC Cross-Play Engine</h1>
            <p className="text-xs text-slate-400">
              Seamlessly allows Bedrock (Android, iOS, Windows, Consoles) and Java players on one server
            </p>
          </div>
        </div>

        {isInstalled ? (
          <button
            onClick={handleUninstall}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-lg text-xs font-semibold transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove GeyserMC</span>
          </button>
        ) : (
          <button
            onClick={handleInstall}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 rounded-lg font-bold text-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>{loading ? 'Installing...' : '1-Click Install Geyser + Floodgate'}</span>
          </button>
        )}
      </div>

      {/* Status Card */}
      <div className="glass-card rounded-xl p-6 border border-white/10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isInstalled ? 'bg-emerald-400' : 'bg-zinc-600'
                }`}
              />
              <h2 className="text-sm font-bold text-white">
                {isInstalled ? 'GeyserMC & Floodgate are Active' : 'GeyserMC Not Installed'}
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              {isInstalled
                ? 'Bedrock players can join using standard Minecraft Bedrock edition on Port 19132.'
                : 'Click the 1-Click Install button above to automatically download GeyserMC & Floodgate into your plugins folder.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Floodgate 2.0
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
              UDP 19132
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      {isInstalled && (
        <div className="glass-card rounded-xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Bedrock Server Settings (config.yml)</span>
            </h3>
            <button
              onClick={handleSaveConfig}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 rounded-lg font-bold text-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Geyser Config</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bedrock Port */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Bedrock UDP Port</label>
              <input
                type="number"
                value={geyserConfig.bedrockPort}
                onChange={(e) =>
                  setGeyserConfig({ ...geyserConfig, bedrockPort: parseInt(e.target.value, 10) || 19132 })
                }
                className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[11px] text-slate-400">Default Bedrock port is 19132.</span>
            </div>

            {/* Auth Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Authentication Mode</span>
              </label>
              <select
                value={geyserConfig.authType}
                onChange={(e) =>
                  setGeyserConfig({ ...geyserConfig, authType: e.target.value as any })
                }
                className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="floodgate">Floodgate (Recommended - No Java MC account needed for Bedrock)</option>
                <option value="online">Online Mode (Requires Mojang/Microsoft Java account)</option>
                <option value="offline">Offline / Cracked</option>
              </select>
              <span className="text-[11px] text-slate-400">
                Floodgate allows phone and console players to join with just their Xbox Gamertag.
              </span>
            </div>

            {/* Bedrock MOTD Line 1 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Bedrock MOTD Line 1</label>
              <input
                type="text"
                value={geyserConfig.motd1}
                onChange={(e) => setGeyserConfig({ ...geyserConfig, motd1: e.target.value })}
                className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Bedrock MOTD Line 2 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Bedrock MOTD Line 2</label>
              <input
                type="text"
                value={geyserConfig.motd2}
                onChange={(e) => setGeyserConfig({ ...geyserConfig, motd2: e.target.value })}
                className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* How to Join Guide for Bedrock Players */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span>How Bedrock Friends Join Your Server</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-obsidian-950/60 p-4 rounded-xl border border-white/5 space-y-2">
            <strong className="text-emerald-400 block font-semibold">📱 Phones & Tablets (Android / iOS)</strong>
            <p className="text-slate-400 leading-relaxed">
              Open Minecraft Bedrock → Play → Servers tab → Scroll to bottom → <strong>Add Server</strong>. Enter your IP and Port <strong>19132</strong>.
            </p>
          </div>

          <div className="bg-obsidian-950/60 p-4 rounded-xl border border-white/5 space-y-2">
            <strong className="text-emerald-400 block font-semibold">💻 Windows 10/11 Bedrock</strong>
            <p className="text-slate-400 leading-relaxed">
              Open Minecraft for Windows → Play → Servers → Add Server. Type your server IP and port <strong>19132</strong>.
            </p>
          </div>

          <div className="bg-obsidian-950/60 p-4 rounded-xl border border-white/5 space-y-2">
            <strong className="text-emerald-400 block font-semibold">🎮 Consoles (Xbox / PS / Switch)</strong>
            <p className="text-slate-400 leading-relaxed">
              Use the free <strong>BedrockTogether</strong> mobile app or custom DNS on console to redirect to your server IP seamlessly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
