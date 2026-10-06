import React, { useState, useEffect } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { GlassCard } from '@/components/common/GlassCard';
import { Badge } from '@/components/common/Badge';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { useDialog } from '../../context/DialogContext';
import { GeyserConfig, isModdedServerSoftware } from '../../types';

export const CrossplayTab: React.FC = () => {
  const { activeServer } = useServerState();
  const { showAlert } = useDialog();
  const [isInstalled, setIsInstalled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [geyserConfig, setGeyserConfig] = useState<GeyserConfig>({
    bedrockPort: 19132,
    bedrockAddress: '0.0.0.0',
    cloneRemotePort: false,
    authType: 'floodgate',
    motd1: 'CraftTogether Bedrock Server',
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

  const isModded = isModdedServerSoftware(activeServer?.serverSoftware);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Amber Warning for Modded Servers */}
      {isModded && (
        <div className="p-4 rounded-xl bg-warning-bg border border-warning-fg/30 text-warning-fg space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-warning-fg shrink-0" />
            <span className="text-xs font-bold">
              Bedrock Cross-Play Incompatible with Java Mods
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-warning-fg/90">
            This server runs on {activeServer?.serverSoftware === 'fabric' ? 'Fabric' : activeServer?.serverSoftware}. Minecraft Bedrock Edition cannot interpret or synchronize Java edition mods, custom entities, or modded items. GeyserMC cross-play is disabled for this server to prevent client crashes.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-content-primary">GeyserMC</h1>
          <p className="text-xs text-content-secondary">
            Enable clients from Minecraft Bedrock Edition to join your Minecraft Java server.
          </p>
        </div>

        {isInstalled ? (
          <Badge variant="success">
            <span>Installed</span>
          </Badge>
        ) : (
          <button
            onClick={handleInstall}
            disabled={loading || isModded}
            className={`flex items-center gap-2 px-4 py-2 bg-success text-white rounded-lg font-bold text-xs transition ${
              isModded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-success/80 cursor-pointer'
            }`}
          >
            <span>
              {isModded ? 'Unavailable on Modded' : loading ? 'Installing...' : '1-Click Install Geyser + Floodgate'}
            </span>
          </button>
        )}
      </div>

      {/* Configuration Form */}
      {isInstalled && (
        <GlassCard className="rounded-xl p-6 border-border-default space-y-6">
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
              <span>Bedrock Server Settings (config.yml)</span>
            </h3>
            <button
              onClick={handleSaveConfig}
              className="flex items-center gap-1.5 px-4 py-2 bg-success hover:bg-success/80 text-white rounded-lg font-bold text-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Geyser Config</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bedrock Port */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content-primary">Bedrock Port</label>
              <input
                type="number"
                value={geyserConfig.bedrockPort}
                onChange={(e) =>
                  setGeyserConfig({ ...geyserConfig, bedrockPort: parseInt(e.target.value, 10) || 19132 })
                }
                className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
              />
              <span className="text-[11px] text-content-secondary">Default Bedrock port is 19132.</span>
            </div>

            {/* Auth Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content-primary flex items-center gap-1.5">
                <span>Authentication Mode</span>
              </label>
              <select
                value={geyserConfig.authType}
                onChange={(e) =>
                  setGeyserConfig({ ...geyserConfig, authType: e.target.value as any })
                }
                className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary focus:outline-none focus:border-border-default"
              >
                <option value="floodgate">Floodgate (Recommended - No Java MC account needed for Bedrock)</option>
                <option value="online">Online Mode (Requires Mojang/Microsoft Java account)</option>
                <option value="offline">Offline / Cracked</option>
              </select>
              <span className="text-[11px] text-content-secondary">
                Floodgate allows phone and console players to join with just their Xbox Gamertag.
              </span>
            </div>

            {/* Bedrock MOTD Line 1 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content-primary">Bedrock MOTD Line 1</label>
              <input
                type="text"
                value={geyserConfig.motd1}
                onChange={(e) => setGeyserConfig({ ...geyserConfig, motd1: e.target.value })}
                className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary focus:outline-none focus:border-border-default"
              />
            </div>

            {/* Bedrock MOTD Line 2 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content-primary">Bedrock MOTD Line 2</label>
              <input
                type="text"
                value={geyserConfig.motd2}
                onChange={(e) => setGeyserConfig({ ...geyserConfig, motd2: e.target.value })}
                className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary focus:outline-none focus:border-border-default"
              />
            </div>
          </div>
        </GlassCard>
      )}

    </div>
  );
};
