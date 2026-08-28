import React, { useState } from 'react';
import { Users, Search, Clock, ShieldAlert, UserMinus, UserX, UserPlus } from 'lucide-react';
import { GlassCard } from '@/components/common/GlassCard';
import { useServer } from '../../context/ServerContext';
import { useDialog } from '../../context/DialogContext';

export const PlayersTab: React.FC = () => {
  const { players, sendCommand, status, metrics } = useServer();
  const { showPrompt } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [whitelistInput, setWhitelistInput] = useState('');

  const filteredPlayers = players.filter((p) =>
    p.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOp = (username: string) => {
    sendCommand(`op ${username}`);
  };

  const handleDeop = (username: string) => {
    sendCommand(`deop ${username}`);
  };

  const handleKick = async (username: string) => {
    const reason = await showPrompt('Kick Player', `Enter reason for kicking ${username}:`, 'Kicked by host');
    if (reason !== null && reason !== undefined) {
      sendCommand(`kick ${username} ${reason}`);
    }
  };

  const handleBan = async (username: string) => {
    const reason = await showPrompt('Ban Player', `Enter reason for banning ${username}:`, 'Banned by host');
    if (reason !== null && reason !== undefined) {
      sendCommand(`ban ${username} ${reason}`);
    }
  };

  const handleAddWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whitelistInput.trim()) return;
    sendCommand(`whitelist add ${whitelistInput.trim()}`);
    setWhitelistInput('');
  };

  const formatJoinTime = (timestamp: number) => {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    const m = Math.floor(elapsed / 60);
    if (m < 1) return 'Just joined';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-elevated text-content-primary flex items-center justify-center border border-border-default">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content-primary">Player Management</h1>
            <p className="text-xs text-content-secondary">
              Live connected players, player avatars, permissions & access control
            </p>
          </div>
        </div>

        {/* Search & Stats */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-content-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search player..."
              className="pl-8 pr-3 py-2 leading-none bg-surface-elevated border border-border-default rounded-lg text-xs text-content-primary focus:outline-none focus:border-border-default"
            />
          </div>

          <span className="text-xs font-semibold px-3 py-2 leading-none bg-surface-base text-content-primary rounded-lg border border-border-default">
            {players.length} / {metrics.maxPlayers} Online
          </span>
        </div>
      </div>

      {/* Online Players Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
          Connected Players ({filteredPlayers.length})
        </h2>

        {filteredPlayers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map((player) => (
              <GlassCard
                key={player.username}
                className="rounded-xl p-4 border-border-default flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={`https://minotar.net/avatar/${player.username}/48.png`}
                    alt={player.username}
                    className="w-10 h-10 rounded-lg shadow-md border border-border-default bg-surface-base"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://minotar.net/avatar/Steve/48.png';
                    }}
                  />
                  <div>
                    <span className="font-bold text-sm text-content-primary block">
                      {player.username}
                    </span>
                    <span className="text-[11px] text-content-secondary flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatJoinTime(player.joinedAt)}
                    </span>
                  </div>
                </div>

                {/* Player Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOp(player.username)}
                    title="Make Operator (OP)"
                    disabled={status !== 'ONLINE'}
                    className="p-2 rounded-lg bg-neutral-bg hover:bg-surface-hover text-content-primary transition disabled:opacity-40"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleKick(player.username)}
                    title="Kick Player"
                    disabled={status !== 'ONLINE'}
                    className="p-2 rounded-lg bg-neutral-bg hover:bg-danger text-content-secondary hover:text-surface-base transition disabled:opacity-40"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleBan(player.username)}
                    title="Ban Player"
                    disabled={status !== 'ONLINE'}
                    className="p-2 rounded-lg bg-danger hover:bg-danger/80 text-surface-base transition disabled:opacity-40"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard className="rounded-2xl p-8 border-border-subtle text-center space-y-2">
            <Users className="w-8 h-8 text-content-secondary mx-auto" />
            <span className="text-sm font-semibold text-content-primary block">No Players Connected</span>
            <p className="text-xs text-content-secondary">
              {status === 'ONLINE'
                ? 'Your server is running! Share your IP from the Network tab so friends can join.'
                : 'Start the server from the Dashboard to allow players to join.'}
            </p>
          </GlassCard>
        )}
      </div>

      {/* Whitelist Manager */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
        <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
          <Users className="w-4 h-4 text-content-primary" />
          <span>Quick Whitelist Manager</span>
        </h3>

        <form onSubmit={handleAddWhitelist} className="flex items-center gap-3">
          <input
            type="text"
            value={whitelistInput}
            onChange={(e) => setWhitelistInput(e.target.value)}
            placeholder="Enter player Minecraft username..."
            className="flex-1 px-4 py-2.5 bg-surface-base border border-border-default rounded-xl text-xs text-content-primary focus:outline-none focus:border-border-default"
          />
          <button
            type="submit"
            disabled={status !== 'ONLINE' || !whitelistInput.trim()}
            className="px-5 py-2.5 bg-success hover:bg-success/80 disabled:opacity-40 text-surface-base font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add to Whitelist</span>
          </button>
        </form>
      </GlassCard>
    </div>
  );
};
