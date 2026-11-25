import React from 'react';
import { Plus, Terminal, Server } from 'lucide-react';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { ServerInstanceConfig } from '../../types';
import logoImg from '../../assets/craftora.png';

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
  const { activeServer, status, servers, isLoadingServers } = useServerState();
  const { selectServer } = useServerActions();

  const handleServerClick = (server: ServerInstanceConfig) => {
    selectServer(server);
    onSelectTab('servers');
  };

  return (
    <aside className="w-64 bg-surface-elevated flex flex-col justify-between p-3 select-none shrink-0 overflow-y-auto">
      <div className="space-y-4">
        {/* BRAND HEADER (Seamlessly elevated at window top) */}
        <div className="flex items-center gap-3.5 px-1 py-1.5 mb-2 titlebar-drag">
          <img
            src={logoImg}
            alt="CraftTogether"
            className="w-[52px] h-[52px] object-contain shrink-0 titlebar-no-drag rounded-xl mix-blend-multiply dark:mix-blend-normal dark:ring-1 dark:ring-white/10 drop-shadow-md select-none transition-transform hover:scale-105 duration-200"
            style={{ imageRendering: 'high-quality', WebkitUserDrag: 'none' } as any}
          />
          <div className="flex flex-col justify-center select-none titlebar-no-drag">
            <span className="font-extrabold text-2xl text-content-primary tracking-tight select-none leading-none">
              CraftTogether
            </span>
          </div>
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
                  <Server className="w-3.5 h-3.5 text-content-primary" />
                  <span>No servers created</span>
                </div>
                <span className="text-[10px] text-content-muted block mt-0.5">Click to create your first server</span>
              </div>
            ) : (
              servers.map((s) => {
                const isSelected = activeTab === 'servers' && activeServer?.id === s.id;
                const isRunning = activeServer?.id === s.id && (status === 'ONLINE' || status === 'STARTING');
                return (
                  <button
                    key={s.id}
                    onClick={() => handleServerClick(s)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold transition-all group relative border ${
                      isSelected
                        ? 'bg-success text-white shadow-sm border-transparent'
                        : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Server Status Dot */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isRunning && status === 'ONLINE'
                            ? 'bg-success'
                            : isRunning && status === 'STARTING'
                            ? 'bg-amber-500 animate-pulse'
                            : isSelected
                            ? 'bg-white'
                            : 'bg-content-muted/50'
                        }`}
                      />
                      <span className={`truncate font-semibold ${isSelected ? 'text-white' : 'text-content-primary'}`}>
                        {s.name}
                      </span>
                    </div>

                    <div className={`flex items-center text-[10px] mt-1 pl-4 ${isSelected ? 'text-white/90' : 'text-content-secondary'}`}>
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
                ? 'bg-success text-white border-transparent shadow-sm'
                : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Terminal
                className={`w-4 h-4 transition ${
                  activeTab === 'console' ? 'text-white' : 'text-content-secondary'
                }`}
              />
              <span className={activeTab === 'console' ? 'text-white' : ''}>Console</span>
            </div>

            {status === 'ONLINE' && (
              <span className={`flex items-center gap-1 text-[10px] font-mono font-bold ${activeTab === 'console' ? 'text-white' : 'text-content-primary'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeTab === 'console' ? 'bg-white' : 'bg-success'} animate-pulse`} />
                Live
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
