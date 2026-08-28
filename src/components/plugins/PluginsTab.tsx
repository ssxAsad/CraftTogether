import React, { useState, useEffect } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { GlassCard } from '@/components/common/GlassCard';
import { Badge } from '@/components/common/Badge';
import { CheckCircle2, Trash2, Download } from 'lucide-react';
import { PluginIcon } from '../common/Icons';
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
          icon: 'PlaceholderIcon',
          recommendedForCracked: true
        },
        {
          id: 'viaversion',
          name: 'ViaVersion',
          description: 'Allows newer Minecraft client versions to connect to your server.',
          category: 'Compatibility',
          downloadUrl: '',
          icon: 'PlaceholderIcon'
        },
        {
          id: 'luckperms',
          name: 'LuckPerms',
          description: 'Industry standard permissions and group management system.',
          category: 'Admin',
          downloadUrl: '',
          icon: 'PlaceholderIcon'
        },
        {
          id: 'essentialsx',
          name: 'EssentialsX',
          description: '100+ essential commands, kits, teleports, and player management.',
          category: 'Core Gameplay',
          downloadUrl: '',
          icon: 'PlaceholderIcon'
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
    return <PluginIcon className="w-5 h-5 text-content-primary" />;
  };

  const isPluginInstalled = (name: string) => {
    return installed.some(p => p.name.toLowerCase().includes(name.toLowerCase()));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-elevated text-content-primary flex items-center justify-center border border-border-default">
            <PluginIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Plugin Manager</h1>
          </div>
        </div>

        <span className="text-xs font-semibold px-3 py-2 leading-none bg-surface-elevated text-content-primary rounded-lg border border-border-default">
          {installed.length} Installed Plugins
        </span>
      </div>

      {/* Popular 1-Click Plugins Catalog */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-content-secondary flex items-center gap-1.5">
          <PluginIcon className="w-3.5 h-3.5 text-content-primary" />
          <span>Recommended Plugins</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((plugin) => {
            const alreadyInstalled = isPluginInstalled(plugin.name);
            const isBusy = installingId === plugin.id;

            return (
              <GlassCard
                key={plugin.id}
                className="rounded-xl p-5 border-border-default flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-neutral-bg border border-border-subtle">
                      {renderIcon(plugin.icon)}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-content-secondary bg-surface-card px-2 py-0.5 rounded border border-border-subtle">
                      {plugin.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-content-primary">{plugin.name}</h3>
                  <p className="text-xs text-content-secondary leading-relaxed">{plugin.description}</p>
                </div>

                <div className="pt-2 border-t border-border-subtle">
                  {alreadyInstalled ? (
                    <div className="flex items-center justify-center gap-1 text-xs font-semibold text-content-primary bg-neutral-bg py-2 rounded-lg border border-border-default">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Installed</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleInstall(plugin.id)}
                      disabled={isBusy}
                      className="w-full py-2 bg-success hover:bg-success/80 text-surface-base font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isBusy ? 'Downloading...' : 'Install'}</span>
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Installed Plugins Table */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
        <h3 className="text-sm font-bold text-content-primary">Installed Server Plugins ({installed.length})</h3>

        {installed.length > 0 ? (
          <div className="divide-y divide-border-subtle">
            {installed.map((plugin) => (
              <div key={plugin.filename} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${plugin.enabled ? 'bg-success-fg' : 'bg-content-muted'}`} />
                  <div>
                    <span className="font-bold text-content-primary block">{plugin.name}</span>
                    <span className="text-[11px] text-content-secondary font-mono">
                      {(plugin.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggle(plugin.filename)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${plugin.enabled ? 'bg-success' : 'bg-content-muted'}`}
                    title={plugin.enabled ? 'Disable Plugin' : 'Enable Plugin'}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${plugin.enabled ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                  </button>

                  <button
                    onClick={() => handleDelete(plugin.filename)}
                    className="p-1.5 rounded-lg bg-danger hover:bg-danger/80 text-surface-base transition"
                    title="Delete Plugin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-content-secondary">
            No plugins installed yet. Click "1-Click Install" on any popular plugin above to add it!
          </div>
        )}
      </GlassCard>
    </div>
  );
};
