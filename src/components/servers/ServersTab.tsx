import React, { useState } from 'react';
import {
  Server,
  PlusCircle,
  LayoutDashboard,
  Globe2,
  Smartphone,
  Sliders,
  Users,
  Puzzle,
  Trash2,
  AlertTriangle,
  X,
  Play,
  Square,
  RotateCw,
  Sparkles
} from 'lucide-react';
import { useServer } from '../../context/ServerContext';
import { DashboardTab } from '../dashboard/DashboardTab';
import { NetworkTab } from '../network/NetworkTab';
import { CrossplayTab } from '../crossplay/CrossplayTab';
import { ConfigTab } from '../config/ConfigTab';
import { PlayersTab } from '../players/PlayersTab';
import { PluginsTab } from '../plugins/PluginsTab';
import confetti from 'canvas-confetti';

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

  const handleStart = async () => {
    const ok = await startServer();
    if (ok) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
  };

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
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Detecting Minecraft servers...</p>
      </div>
    );
  }

  // If no servers created yet, show clean empty state
  if (servers.length === 0 || !activeServer) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Server className="w-8 h-8 text-emerald-400 font-bold" />
        </div>

        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-white">No Minecraft Servers Yet</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Create your first Minecraft server with 1-click Paper/Purpur installation, GeyserMC Bedrock cross-play, free ngrok sharing, and cracked support.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 font-bold text-xs rounded-lg flex items-center gap-2 transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create a New Server</span>
        </button>
      </div>
    );
  }

  const subNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'network', label: 'Network', icon: Globe2 },
    { id: 'crossplay', label: 'Cross-Play', icon: Smartphone },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'config', label: 'Settings', icon: Sliders },
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
      <div className="bg-obsidian-950 border-b border-white/5 px-5 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {subNavItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as ServerSubTabType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/60 text-red-400 hover:text-red-200 border border-red-500/20 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Server</span>
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
          <div className="glass-panel w-full max-w-md rounded-xl border border-white/10 shadow-2xl p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 border border-red-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Delete Server</h3>
                <p className="text-xs text-slate-300">
                  Are you sure you want to delete <strong className="text-white font-semibold">{activeServer.name}</strong>?
                </p>
                <p className="text-[11px] text-slate-400 pt-1">
                  All world saves, configurations, and plugins will be permanently removed from disk.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
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
