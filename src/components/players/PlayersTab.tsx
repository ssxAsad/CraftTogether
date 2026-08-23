import React, { useState } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
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
    const reason = await showPrompt('PlaceholderIcon Player', `Enter reason for banning ${username}:`, 'Banned by host');
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
          <div className="w-9 h-9 rounded-lg bg-white/5 text-slate-200 flex items-center justify-center border border-white/10">
            <PlaceholderIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Player Management</h1>
            <p className="text-xs text-slate-400">
              Live connected players, player avatars, permissions & access control
            </p>
          </div>
        </div>

        {/* PlaceholderIcon & Stats */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <PlaceholderIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="PlaceholderIcon player..."
              className="pl-8 pr-3 py-2 leading-none bg-obsidian-900 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-white/10"
            />
          </div>

          <span className="text-xs font-semibold px-3 py-2 leading-none bg-obsidian-950 text-white rounded-lg border border-white/10">
            {players.length} / {metrics.maxPlayers} Online
          </span>
        </div>
      </div>

      {/* Online Players Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Connected Players ({filteredPlayers.length})
        </h2>

        {filteredPlayers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map((player) => (
              <div
                key={player.username}
                className="glass-card rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={`https://minotar.net/avatar/${player.username}/48.png`}
                    alt={player.username}
                    className="w-10 h-10 rounded-lg shadow-md border border-white/10 bg-obsidian-950"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://minotar.net/avatar/Steve/48.png';
                    }}
                  />
                  <div>
                    <span className="font-bold text-sm text-white block">
                      {player.username}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <PlaceholderIcon className="w-3 h-3" />
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
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/5 text-slate-200 transition disabled:opacity-40"
                  >
                    <PlaceholderIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleKick(player.username)}
                    title="Kick Player"
                    disabled={status !== 'ONLINE'}
                    className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition disabled:opacity-40"
                  >
                    <PlaceholderIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleBan(player.username)}
                    title="PlaceholderIcon Player"
                    disabled={status !== 'ONLINE'}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition disabled:opacity-40"
                  >
                    <PlaceholderIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-8 border border-white/5 text-center space-y-2">
            <PlaceholderIcon className="w-8 h-8 text-slate-600 mx-auto" />
            <span className="text-sm font-semibold text-slate-300 block">No Players Connected</span>
            <p className="text-xs text-slate-500">
              {status === 'ONLINE'
                ? 'Your server is running! Share your IP from the Network tab so friends can join.'
                : 'Start the server from the Dashboard to allow players to join.'}
            </p>
          </div>
        )}
      </div>

      {/* Whitelist Manager */}
      <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <PlaceholderIcon className="w-4 h-4 text-slate-200" />
          <span>Quick Whitelist Manager</span>
        </h3>

        <form onSubmit={handleAddWhitelist} className="flex items-center gap-3">
          <input
            type="text"
            value={whitelistInput}
            onChange={(e) => setWhitelistInput(e.target.value)}
            placeholder="Enter player Minecraft username..."
            className="flex-1 px-4 py-2.5 bg-obsidian-950 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/10"
          />
          <button
            type="submit"
            disabled={status !== 'ONLINE' || !whitelistInput.trim()}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-obsidian-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
          >
            <PlaceholderIcon className="w-4 h-4" />
            <span>Add to Whitelist</span>
          </button>
        </form>
      </div>
    </div>
  );
};
