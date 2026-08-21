import React from 'react';
import {
  Server,
  Terminal,
  PlusCircle,
  Plus,
  Wifi,
  Globe2,
  Radio,
  Sparkles,
  Layers
} from 'lucide-react';
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
        return { label: 'LAN', color: 'text-zinc-400 bg-obsidian-950 border-white/10' };
      case 'upnp':
        return { label: 'UPnP', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'cloud_relay':
      default:
        return { label: 'PlayIt.gg', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
  };

  const handleServerClick = (server: ServerInstanceConfig) => {
    selectServer(server);
    onSelectTab('servers');
  };

  return (
    <aside className="w-64 bg-obsidian-900 border-r border-white/5 flex flex-col justify-between p-3 select-none shrink-0 overflow-y-auto">
      <div className="space-y-4">
        {/* BRAND HEADER (Seamlessly elevated at window top) */}
        <div className="flex items-center gap-2.5 px-1 py-1 mb-1 titlebar-drag">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center p-1 shadow-sm shrink-0 titlebar-no-drag">
            <img
              src={logoImg}
              alt="Craftora"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-base text-white tracking-tight titlebar-no-drag select-none">
            Craftora
          </span>
        </div>

        {/* SERVERS SECTION */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Server className="w-3.5 h-3.5 text-emerald-500" />
              <span>Servers</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-obsidian-800 text-slate-300 border border-white/10 ml-1">
                {servers.length}
              </span>
            </div>

            <button
              onClick={onOpenCreateModal}
              title="Create New Server"
              className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 transition border border-transparent hover:border-emerald-500/30"
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
                className="w-full text-left p-3 rounded-xl border border-dashed border-white/10 hover:border-emerald-500/30 bg-obsidian-950/40 hover:bg-emerald-950/20 cursor-pointer transition text-xs group"
              >
                <div className="text-slate-400 group-hover:text-emerald-300 font-semibold flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>No servers created</span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">Click to create your first server</span>
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
                        ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Server Status Dot */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isRunning && status === 'ONLINE'
                              ? 'bg-emerald-500'
                              : isRunning && status === 'STARTING'
                              ? 'bg-emerald-400 animate-pulse'
                              : isSelected
                              ? 'bg-emerald-500'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span className="truncate font-semibold text-slate-200 group-hover:text-white">
                          {s.name}
                        </span>
                      </div>

                      {/* Network Mode Badge */}
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pl-4">
                      <span className="uppercase font-mono">
                        {s.serverSoftware} {s.version}
                      </span>
                      <span className="font-mono text-emerald-400/80">:{s.port}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Add Server Button */}
          <button
            onClick={onOpenCreateModal}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-500/30 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Server</span>
          </button>
        </div>

        {/* CONSOLE TAB */}
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={() => onSelectTab('console')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'console'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Terminal
                className={`w-4 h-4 transition ${
                  activeTab === 'console' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <span>Console</span>
            </div>

            {status === 'ONLINE' && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
