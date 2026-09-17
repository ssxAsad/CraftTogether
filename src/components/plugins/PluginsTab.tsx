import React, { useState, useEffect } from 'react';
import { GlassCard } from '@/components/common/GlassCard';
import { CheckCircle2, Trash2, Download, Puzzle, Search, Loader2 } from 'lucide-react';

import { useServerState } from '../../context/ServerContext';
import { useDialog } from '../../context/DialogContext';
import { PluginInfo, PopularPlugin } from '../../types';

interface SpigetPlugin {
  id: string;
  name: string;
  tag: string;
  downloads: number;
}

export const PluginsTab: React.FC = () => {
  const { activeServer } = useServerState();
  const { showAlert, showConfirm } = useDialog();
  const [catalog, setCatalog] = useState<PopularPlugin[]>([]);
  const [installed, setInstalled] = useState<PluginInfo[]>([]);
  const [installingId, setInstallingId] = useState<string | null>(null);

  // Spiget Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpigetPlugin[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const loadData = async () => {
    if (!activeServer) return;
    if (window.electronAPI) {
      const cat = await window.electronAPI.getPluginCatalog();
      setCatalog(cat);

      const inst = await window.electronAPI.getInstalledPlugins(activeServer.id);
      setInstalled(inst);
    } else {
      // Mock for browser
      setCatalog([]);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeServer]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch(`https://api.spiget.org/v2/search/resources/${encodeURIComponent(searchQuery)}?field=name&size=12`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Failed to search Spiget API', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const normalizePluginName = (s: string) => {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const isPluginInstalled = (name: string) => {
    const target = normalizePluginName(name);
    if (!target) return false;

    return installed.some(p => {
      const installedNorm = normalizePluginName(p.name);
      return installedNorm.includes(target) || target.includes(installedNorm);
    });
  };

  const handleInstall = async (plugin: PopularPlugin) => {
    if (!activeServer) return;
    setInstallingId(plugin.id);
    if (window.electronAPI) {
      try {
        await window.electronAPI.installPlugin({
          serverId: activeServer.id,
          pluginId: plugin.id
        });

        // Optimistically record as installed immediately so UI updates on 1st click
        setInstalled(prev => {
          if (prev.some(p => normalizePluginName(p.name).includes(normalizePluginName(plugin.name)) || normalizePluginName(plugin.name).includes(normalizePluginName(p.name)))) {
            return prev;
          }
          return [...prev, {
            name: plugin.name,
            filename: `${plugin.name}.jar`,
            size: 1024 * 1024,
            enabled: true,
            isCustom: true
          }];
        });

        // Small yield to let Windows NTFS finish directory indexing
        await new Promise(r => setTimeout(r, 120));
        await loadData();
      } catch (err) {
        await showAlert('Plugin Install Error', `Failed to install plugin: ${err}`, 'warning');
      }
    }
    setInstallingId(null);
  };

  const handleInstallSpiget = async (plugin: SpigetPlugin) => {
    if (!activeServer) return;
    setInstallingId(plugin.id);
    if (window.electronAPI && window.electronAPI.installSpigetPlugin) {
      try {
        await window.electronAPI.installSpigetPlugin({
          serverId: activeServer.id,
          spigetId: plugin.id,
          pluginName: plugin.name
        });

        // Optimistically record as installed immediately
        const safeName = plugin.name.replace(/[^a-zA-Z0-9_\-\ ]/g, '').trim().replace(/\ /g, '_');
        setInstalled(prev => {
          if (prev.some(p => normalizePluginName(p.name).includes(normalizePluginName(plugin.name)) || normalizePluginName(plugin.name).includes(normalizePluginName(p.name)))) {
            return prev;
          }
          return [...prev, {
            name: safeName,
            filename: `${safeName}.jar`,
            size: 1024 * 1024,
            enabled: true,
            isCustom: true
          }];
        });

        await new Promise(r => setTimeout(r, 120));
        await loadData();
        await showAlert('Success', `Installed plugin ${plugin.name} successfully.`, 'success');
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
    return <Puzzle className="w-8 h-8 text-content-primary" />;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Plugin Manager</h1>
        </div>

        <span className="text-xs font-semibold px-3 py-2 leading-none bg-surface-elevated text-content-primary rounded-lg border border-border-default">
          {installed.length} Installed Plugins
        </span>
      </div>

      {/* Spiget Search Area */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
        <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
          <Search className="w-4 h-4" />
          Search Paper/Bukkit Plugins
        </h3>
        
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for plugins (e.g. WorldEdit, HolographicDisplays)..."
              className="w-full bg-neutral-bg border border-border-default rounded-lg py-2.5 pl-10 pr-4 text-sm text-content-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-6 py-2.5 bg-success hover:bg-success/80 text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </form>

        {/* Search Results */}
        {hasSearched && (
          <div className="pt-4 mt-4 border-t border-border-subtle">
            <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary mb-3">Search Results</h4>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {searchResults.map((plugin) => {
                  const alreadyInstalled = isPluginInstalled(plugin.name);
                  const isBusy = installingId === plugin.id;

                  return (
                    <div key={plugin.id} className="bg-surface-elevated rounded-xl p-4 border border-border-default flex flex-col justify-between space-y-3">
                      <div>
                        <h5 className="font-bold text-sm text-content-primary line-clamp-1" title={plugin.name}>{plugin.name}</h5>
                        <p className="text-xs text-content-secondary line-clamp-2 mt-1" title={plugin.tag}>{plugin.tag || 'No description provided.'}</p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
                        <span className="text-[10px] text-content-secondary">{plugin.downloads} downloads</span>
                        {alreadyInstalled ? (
                          <span className="text-xs font-semibold text-success flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Installed
                          </span>
                        ) : (
                          <button
                            onClick={() => handleInstallSpiget(plugin)}
                            disabled={isBusy}
                            className="px-3 py-1.5 bg-success hover:bg-success/80 text-white font-bold text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {isBusy ? 'Installing...' : 'Install'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-content-secondary">
                {isSearching ? 'Searching...' : 'No plugins found matching your query.'}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Popular 1-Click Plugins Catalog */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-content-secondary flex items-center gap-1.5">
          <span>Recommended Essentials</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    {renderIcon(plugin.icon)}
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
                      onClick={() => handleInstall(plugin)}
                      disabled={isBusy}
                      className="w-full py-2 bg-success hover:bg-success/80 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
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
                    className="p-1.5 rounded-lg bg-danger hover:bg-danger/80 text-white transition"
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
            No plugins installed yet. Search for one above or click "Install" on a recommended plugin!
          </div>
        )}
      </GlassCard>
    </div>
  );
};
