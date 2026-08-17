import React, { useState, useEffect } from 'react';
import {
  Puzzle,
  Download,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  Shield,
  Zap,
  Lock,
  Wrench,
  UserCheck,
  Smartphone,
  History,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { useDialog } from '../../context/DialogContext';
import { PluginInfo, PopularPlugin } from '../../types';

export const PluginsTab: React.FC = () => {
  const { activeServer } = useServer();
  const { showAlert, showConfirm } = useDialog();
  const [catalog, setCatalog] = useState<PopularPlugin[]>([]);
  const [installed, setInstalled] = useState<PluginInfo[]>([]);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!activeServer) return;
    if (window.electronAPI) {
      const cat = await window.electronAPI.getPluginCatalog();
      setCatalog(cat);

      const inst = await window.electronAPI.getInstalledPlugins(activeServer.id);
      setInstalled(inst);
    } else {
      // Mock for browser
      setCatalog([
        {
          id: 'skinsrestorer',
          name: 'SkinsRestorer',
          description: 'Restores player skins for cracked (offline-mode) servers & allows /skin commands.',
          category: 'Cracked / Cosmetic',
          downloadUrl: '',
          icon: 'UserCheck',
          recommendedForCracked: true
        },
        {
          id: 'viaversion',
          name: 'ViaVersion',
          description: 'Allows newer Minecraft client versions to connect to your server.',
          category: 'Compatibility',
          downloadUrl: '',
          icon: 'Layers'
        },
        {
          id: 'luckperms',
          name: 'LuckPerms',
          description: 'Industry standard permissions and group management system.',
          category: 'Admin',
          downloadUrl: '',
          icon: 'Shield'
        },
        {
          id: 'essentialsx',
          name: 'EssentialsX',
          description: '100+ essential commands, kits, teleports, and player management.',
          category: 'Core Gameplay',
          downloadUrl: '',
          icon: 'Wrench'
        }
      ]);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeServer]);

  const handleInstall = async (pluginId: string) => {
    if (!activeServer) return;
    setInstallingId(pluginId);
    if (window.electronAPI) {
      try {
        await window.electronAPI.installPlugin({
          serverId: activeServer.id,
          pluginId
        });
        await loadData();
      } catch (err) {
        await showAlert('Plugin Install Error', `Failed to install plugin: ${err}`, 'warning');
      }
    }
    setInstallingId(null);
  };

  const handleToggle = async (filename: string) => {
    if (!activeServer) return;
    if (window.electronAPI) {
      await window.electronAPI.togglePlugin({
        serverId: activeServer.id,
        filename
      });
      await loadData();
    }
  };

  const handleDelete = async (filename: string) => {
    if (!activeServer) return;
    const confirmed = await showConfirm('Delete Plugin', `Are you sure you want to permanently delete "${filename}"?`, {
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (confirmed) {
      if (window.electronAPI) {
        await window.electronAPI.deletePlugin({
          serverId: activeServer.id,
          filename
        });
        await loadData();
      }
    }
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'UserCheck': return <UserCheck className="w-5 h-5 text-amber-400" />;
      case 'Smartphone': return <Smartphone className="w-5 h-5 text-cyan-400" />;
      case 'Layers': return <Layers className="w-5 h-5 text-emerald-400" />;
      case 'History': return <History className="w-5 h-5 text-violet-400" />;
      case 'Shield': return <Shield className="w-5 h-5 text-blue-400" />;
      case 'Wrench': return <Wrench className="w-5 h-5 text-emerald-400" />;
      case 'Zap': return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Lock': return <Lock className="w-5 h-5 text-red-400" />;
      default: return <Puzzle className="w-5 h-5 text-emerald-400" />;
    }
  };

  const isPluginInstalled = (name: string) => {
    return installed.some(p => p.name.toLowerCase().includes(name.toLowerCase()));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Puzzle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Plugin Store & Manager</h1>
            <p className="text-xs text-slate-400">
              1-Click popular plugins (SkinsRestorer, ViaVersion, LuckPerms) & installed plugins
            </p>
          </div>
        </div>

        <span className="text-xs font-semibold px-3 py-1.5 bg-emerald-950/60 text-emerald-300 rounded-lg border border-emerald-500/30">
          {installed.length} Installed Plugins
        </span>
      </div>

      {/* Popular 1-Click Plugins Catalog */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Curated 1-Click Popular Plugins</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((plugin) => {
            const alreadyInstalled = isPluginInstalled(plugin.name);
            const isBusy = installingId === plugin.id;

            return (
              <div
                key={plugin.id}
                className="glass-card rounded-xl p-5 border border-white/10 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                      {renderIcon(plugin.icon)}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-obsidian-900 px-2 py-0.5 rounded border border-white/5">
                      {plugin.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-white">{plugin.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{plugin.description}</p>
                </div>

                <div className="pt-2 border-t border-white/5">
                  {alreadyInstalled ? (
                    <div className="flex items-center justify-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 py-2 rounded-lg border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Installed</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleInstall(plugin.id)}
                      disabled={isBusy}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Downloading...' : '1-Click Install'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Installed Plugins Table */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-white">Installed Server Plugins ({installed.length})</h3>

        {installed.length > 0 ? (
          <div className="divide-y divide-white/5">
            {installed.map((plugin) => (
              <div key={plugin.filename} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${plugin.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  <div>
                    <span className="font-bold text-white block">{plugin.name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {(plugin.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggle(plugin.filename)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white transition"
                    title={plugin.enabled ? 'Disable Plugin' : 'Enable Plugin'}
                  >
                    {plugin.enabled ? (
                      <ToggleRight className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-slate-500" />
                    )}
                    <span>{plugin.enabled ? 'Enabled' : 'Disabled'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(plugin.filename)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                    title="Delete Plugin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-500">
            No plugins installed yet. Click "1-Click Install" on any popular plugin above to add it!
          </div>
        )}
      </div>
    </div>
  );
};
