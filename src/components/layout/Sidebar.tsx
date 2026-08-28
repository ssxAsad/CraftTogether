import React from 'react';
import { Plus, Terminal, Server } from 'lucide-react';
import { PlaceholderIcon } from '../common/PlaceholderIcon';
import { useServer } from '../../context/ServerContext';
import { NetworkMode, ServerInstanceConfig } from '../../types';
import logoImg from '../../assets/DC.png';

export type MainTabType = 'servers' | 'console';

interface SidebarProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
  onOpenCreateModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreateModal
}) => {
  const { activeServer, status, servers, selectServer, isLoadingServers } = useServer();

  const getNetworkBadge = (mode?: NetworkMode) => {
    switch (mode) {
      case 'lan_only':
        return { label: 'LAN', color: 'text-content-muted bg-surface-base border-border-default' };
      case 'upnp':
        return { label: 'UPnP', color: 'text-content-primary bg-neutral-bg border-border-default' };
      case 'cloud_relay':
      default:
        return { label: 'PlayIt.gg', color: 'text-content-primary bg-neutral-bg border-border-default' };
    }
  };

  const handleServerClick = (server: ServerInstanceConfig) => {
    selectServer(server);
    onSelectTab('servers');
  };

  return (
    <aside className="w-64 bg-surface-elevated flex flex-col justify-between p-3 select-none shrink-0 overflow-y-auto">
      <div className="space-y-4">
        {/* BRAND HEADER (Seamlessly elevated at window top) */}
        <div className="flex items-center gap-3 px-1 py-2 mb-2 titlebar-drag">
          <img
            src={logoImg}
            alt="Craftora"
            className="w-9 h-9 object-contain shrink-0 titlebar-no-drag"
          />
          <span className="font-extrabold text-xl text-content-primary tracking-tight titlebar-no-drag select-none">
            Craftora
          </span>
        </div>

        {/* SERVERS SECTION */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-content-secondary">
              <Server className="w-3.5 h-3.5 text-content-primary" />
              <span>Servers</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-card text-content-primary border border-border-default ml-1">
                {servers.length}
              </span>
            </div>

            <button
              onClick={onOpenCreateModal}
              title="Create New Server"
              className="p-1 rounded-md text-content-primary hover:bg-surface-base transition border border-transparent hover:border-border-default"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of Created Servers under Servers heading */}
          <div className="space-y-1">
            {isLoadingServers ? (
              <div className="p-3 rounded-xl bg-white/5 animate-pulse space-y-2">
                <div className="h-3 w-28 bg-white/10 rounded" />
                <div className="h-2 w-16 bg-white/5 rounded" />
              </div>
            ) : servers.length === 0 ? (
              <div
                onClick={onOpenCreateModal}
                className="w-full text-left p-3 rounded-xl border border-dashed border-border-default hover:border-border-default bg-surface-base/40 hover:bg-surface-hover cursor-pointer transition text-xs group"
              >
                <div className="text-content-secondary group-hover:text-content-primary font-semibold flex items-center gap-1.5">
                  <PlaceholderIcon className="w-3.5 h-3.5 text-content-primary" />
                  <span>No servers created</span>
                </div>
                <span className="text-[10px] text-content-muted block mt-0.5">Click to create your first server</span>
              </div>
            ) : (
              servers.map((s) => {
                const isSelected = activeTab === 'servers' && activeServer?.id === s.id;
                const isRunning = activeServer?.id === s.id && (status === 'ONLINE' || status === 'STARTING');
                const badge = getNetworkBadge(s.networkMode);

                return (
                  <button
                    key={s.id}
                    onClick={() => handleServerClick(s)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition-all group relative border ${
                      isSelected
                        ? 'bg-success/90 text-surface-base shadow-sm border-transparent'
                        : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Server Status Dot */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning && status === 'ONLINE'
                              ? 'bg-success'
                              : isRunning && status === 'STARTING'
                              ? 'bg-white'
                              : isSelected
                              ? 'bg-white'
                              : 'bg-neutral-bg'
                          }`}
                        />
                        <span className="truncate font-semibold text-white">
                          {s.name}
                        </span>
                      </div>

                      {/* Network Mode Badge */}
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${isSelected ? 'bg-white/20 text-white border-transparent' : badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className={`flex items-center text-[10px] mt-1 pl-4 ${isSelected ? 'text-surface-base/70' : 'text-content-muted'}`}>
                      <span className="uppercase font-mono">
                        {s.serverSoftware} {s.version}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Add Server Button */}
          <button
            onClick={onOpenCreateModal}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-content-primary hover:text-content-primary bg-surface-base hover:bg-surface-base border border-border-default transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Server</span>
          </button>
        </div>

        {/* CONSOLE TAB */}
        <div className="pt-2 border-t border-border-subtle">
          <button
            onClick={() => onSelectTab('console')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'console'
                ? 'bg-success/90 text-surface-base border-transparent'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Terminal
                className={`w-4 h-4 transition ${
                  activeTab === 'console' ? 'text-surface-base' : 'text-content-secondary'
                }`}
              />
              <span>Console</span>
            </div>

            {status === 'ONLINE' && (
              <span className="flex items-center gap-1 text-[10px] text-content-primary font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
