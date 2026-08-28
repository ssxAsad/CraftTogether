import React, { useState } from 'react';
import { PlaceholderIcon } from '../common/PlaceholderIcon';
import { Trash2, LayoutDashboard, Globe, Gamepad2, Users, Settings } from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { PluginIcon } from '../common/Icons';
import { DashboardTab } from '../dashboard/DashboardTab';
import { NetworkTab } from '../network/NetworkTab';
import { CrossplayTab } from '../crossplay/CrossplayTab';
import { ConfigTab } from '../config/ConfigTab';
import { PlayersTab } from '../players/PlayersTab';
import { PluginsTab } from '../plugins/PluginsTab';


export type ServerSubTabType =
  | 'overview'
  | 'network'
  | 'crossplay'
  | 'plugins'
  | 'players'
  | 'config';

interface ServersTabProps {
  onOpenCreateModal: () => void;
  onNavigateToConsole: () => void;
}

export const ServersTab: React.FC<ServersTabProps> = ({
  onOpenCreateModal,
  onNavigateToConsole
}) => {
  const { servers, activeServer, isLoadingServers, status, deleteServer, startServer } = useServer();
  const [activeSubTab, setActiveSubTab] = useState<ServerSubTabType>('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!activeServer) return;
    setIsDeleting(true);
    try {
      await deleteServer(activeServer.id);
      setShowDeleteModal(false);
    } catch (e) {
      console.error('Failed to delete server', e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state while checking disk for server instances
  if (isLoadingServers) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-border-default border-t-transparent animate-spin" />
        <p className="text-xs text-content-secondary font-medium">Detecting Minecraft servers...</p>
      </div>
    );
  }

  // If no servers created yet, show clean empty state
  if (servers.length === 0 || !activeServer) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border-default flex items-center justify-center">
          <PlaceholderIcon className="w-8 h-8 text-content-primary font-bold" />
        </div>

        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-content-primary">No Minecraft Servers Yet</h2>
          <p className="text-xs text-content-secondary leading-relaxed">
            Create your first Minecraft server with 1-click Paper/Purpur installation, GeyserMC Bedrock cross-play, PlayIt.gg Tunnel & UPnP sharing, and cracked support.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="px-6 py-2.5 bg-success hover:bg-success/80 text-surface-base font-bold text-xs rounded-lg flex items-center gap-2 transition"
        >
          <PlaceholderIcon className="w-4 h-4" />
          <span>Create a New Server</span>
        </button>
      </div>
    );
  }

  const subNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'network', label: 'Network', icon: Globe },
    { id: 'crossplay', label: 'Cross-Play', icon: Gamepad2 },
    { id: 'plugins', label: 'Plugins', icon: PluginIcon },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'config', label: 'Settings', icon: Settings },
  ];

  const renderSubTab = () => {
    switch (activeSubTab) {
      case 'overview':
        return <DashboardTab onNavigateTab={(tab) => {
          if (tab === 'console') onNavigateToConsole();
          else setActiveSubTab(tab as ServerSubTabType);
        }} />;
      case 'network':
        return <NetworkTab />;
      case 'crossplay':
        return <CrossplayTab />;
      case 'plugins':
        return <PluginsTab />;
      case 'players':
        return <PlayersTab />;
      case 'config':
        return <ConfigTab />;
      default:
        return <DashboardTab onNavigateTab={(tab) => {
          if (tab === 'console') onNavigateToConsole();
          else setActiveSubTab(tab as ServerSubTabType);
        }} />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Simplified, Compact Sub-Tabs Navigation Header */}
      <div className="bg-surface-base border-b border-border-subtle px-5 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {subNavItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as ServerSubTabType)}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 leading-none rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-success text-surface-base font-bold shadow-sm border-transparent'
                    : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Top-right Actions: Delete Server */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={status !== 'STOPPED'}
            title={status !== 'STOPPED' ? 'Stop server first to delete' : 'Delete Server'}
            className="p-2 rounded-lg bg-red-700 hover:bg-red-800 text-surface-base transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Sub-Tab Content View */}
      <div className="flex-1 overflow-hidden">
        {renderSubTab()}
      </div>

      {/* Delete Server Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated w-full max-w-md rounded-xl border border-border-default shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-transparent text-danger-fg flex items-center justify-center shrink-0 border border-danger-fg">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-content-primary">Delete Server</h3>
                <p className="text-xs text-content-secondary">
                  Are you sure you want to delete <strong className="text-content-primary font-semibold">{activeServer.name}</strong>?
                </p>
                <p className="text-[11px] text-content-secondary pt-1">
                  All world saves, configurations, and plugins will be permanently removed from disk.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-neutral-bg hover:bg-surface-hover text-content-primary text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-danger hover:bg-danger/80 text-surface-base text-xs font-bold rounded-lg transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Server'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
