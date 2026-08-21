import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  ShieldAlert,
  Users,
  Eye,
  Swords,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Zap,
  HardDrive,
  Cpu,
  ShieldCheck,
  Compass,
  Moon,
  Flame,
  PackageCheck
} from 'lucide-react';
import { JavaIcon } from '../common/Icons';
import { useServer } from '../../context/ServerContext';
import { ServerProperties } from '../../types';

export const ConfigTab: React.FC = () => {
  const { activeServer, javaRuntimes, updateServerConfig, refreshServers, status, sendCommand } = useServer();
  const [activeSection, setActiveSection] = useState<'game' | 'performance'>('game');

  const [properties, setProperties] = useState<ServerProperties>({
    'server-port': 25565,
    'online-mode': true,
    'motd': 'A Craftora Minecraft Server',
    'max-players': 20,
    'difficulty': 'normal',
    'gamemode': 'survival',
    'pvp': true,
    'hardcore': false,
    'enable-command-block': true,
    'spawn-protection': 16,
    'view-distance': 10,
    'simulation-distance': 10,
    'white-list': false,
    'allow-flight': true
  });

  const [ramGb, setRamGb] = useState(activeServer?.allocatedRamGb || 4);
  const [useAikar, setUseAikar] = useState(activeServer?.useAikarFlags !== false);
  const [selectedJava, setSelectedJava] = useState(activeServer?.javaPath || javaRuntimes[0]?.path || 'java');

  // Gameplay Gamerules State
  const [keepInventory, setKeepInventory] = useState(activeServer?.keepInventory !== false);
  const [showCoordinates, setShowCoordinates] = useState(activeServer?.showCoordinates !== false);
  const [onePlayerSleep, setOnePlayerSleep] = useState(activeServer?.onePlayerSleep !== false);
  const [disableMobGriefing, setDisableMobGriefing] = useState(activeServer?.disableMobGriefing === true);
  const [disableFireSpread, setDisableFireSpread] = useState(activeServer?.disableFireSpread === true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const loadProps = async () => {
      if (!activeServer) return;
      setRamGb(activeServer.allocatedRamGb || 4);
      setUseAikar(activeServer.useAikarFlags !== false);
      setSelectedJava(activeServer.javaPath || javaRuntimes[0]?.path || 'java');
      setKeepInventory(activeServer.keepInventory !== false);
      setShowCoordinates(activeServer.showCoordinates !== false);
      setOnePlayerSleep(activeServer.onePlayerSleep !== false);
      setDisableMobGriefing(activeServer.disableMobGriefing === true);
      setDisableFireSpread(activeServer.disableFireSpread === true);

      if (window.electronAPI) {
        const props = await window.electronAPI.readProperties(activeServer.id);
        if (props) setProperties(props);
      }
    };
    loadProps();
  }, [activeServer, javaRuntimes]);

  const handleToggleCracked = async (isCracked: boolean) => {
    setProperties(prev => ({ ...prev, 'online-mode': !isCracked }));
    if (activeServer && window.electronAPI) {
      await window.electronAPI.setCrackedMode({
        serverId: activeServer.id,
        isCracked
      });
      if (isCracked) {
        await window.electronAPI.ensureSkinsRestorer(activeServer.id);
      }
      await refreshServers();
    }
  };

  const handleSave = async () => {
    if (!activeServer) return;
    setSaving(true);

    if (window.electronAPI) {
      await window.electronAPI.writeProperties({
        serverId: activeServer.id,
        properties
      });
      await updateServerConfig(activeServer.id, {
        allocatedRamGb: ramGb,
        useAikarFlags: useAikar,
        javaPath: selectedJava,
        keepInventory,
        showCoordinates,
        onePlayerSleep,
        disableMobGriefing,
        disableFireSpread
      });

      // If server is currently running, dispatch real-time gamerules to server console
      if (status === 'ONLINE') {
        await sendCommand(`gamerule keepInventory ${keepInventory ? 'true' : 'false'}`);
        await sendCommand(`gamerule showCoordinates ${showCoordinates ? 'true' : 'false'}`);
        await sendCommand(`gamerule playersSleepingPercentage ${onePlayerSleep ? 1 : 100}`);
        await sendCommand(`gamerule mobGriefing ${disableMobGriefing ? 'false' : 'true'}`);
        await sendCommand(`gamerule doFireTick ${disableFireSpread ? 'false' : 'true'}`);
      }

      await refreshServers();
    }

    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const isCracked = properties['online-mode'] === false;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header with Section Pill Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Server Settings & Configuration</h1>
            <p className="text-xs text-slate-400">
              Manage gameplay properties, cracked mode, dedicated RAM, and Java runtime
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Section Pills */}
          <div className="flex items-center gap-1 bg-obsidian-900 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setActiveSection('game')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeSection === 'game'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Gameplay & World</span>
            </button>
            <button
              onClick={() => setActiveSection('performance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                activeSection === 'performance'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>RAM & Performance</span>
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 rounded-lg font-bold text-xs transition"
          >
            {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saveSuccess ? 'Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {activeSection === 'game' ? (
        <>
          {/* Featured: Cracked / Online Mode Switcher Card */}
          <div className="glass-card rounded-xl p-6 border border-white/10 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">Cracked (Offline Mode) Support</h2>
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      isCracked
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-zinc-800 text-zinc-400 border-white/5'
                    }`}
                  >
                    {isCracked ? 'Cracked Allowed' : 'Premium Only'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  When enabled (`online-mode=false`), players with custom launchers (e.g. TLauncher, SKLauncher, Prism) can join.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-obsidian-900 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => handleToggleCracked(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    !isCracked
                      ? 'bg-zinc-800 text-white border border-white/10'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Premium Only
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCracked(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    isCracked
                      ? 'bg-emerald-500 text-obsidian-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cracked & Premium
                </button>
              </div>
            </div>

            {isCracked && (
              <div className="bg-obsidian-900 border border-white/10 p-3.5 rounded-lg flex items-start gap-3 text-xs text-slate-300">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Skin Restoration Active:</strong> Craftora auto-injects SkinsRestorer so cracked players keep their skins and can use <code>/skin &lt;name&gt;</code> in-game!
                </div>
              </div>
            )}
          </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Popular Gameplay Enhancements (Gamerules) Card */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4 md:col-span-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <PackageCheck className="w-4 h-4 text-emerald-400" />
            <span>Popular Gameplay Enhancements (Live GameRules)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Keep Inventory */}
            <div className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-white block">Keep Inventory</span>
                  <span className="text-[10px] text-slate-400">Keep items & XP upon dying</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={keepInventory}
                onChange={(e) => setKeepInventory(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Show Coordinates */}
            <div className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-white block">Show Coordinates HUD</span>
                  <span className="text-[10px] text-slate-400">Live X, Y, Z on screen for Bedrock & Java</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={showCoordinates}
                onChange={(e) => setShowCoordinates(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Instant 1-Player Sleep */}
            <div className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-white block">Instant 1-Player Sleep</span>
                  <span className="text-[10px] text-slate-400">1 player in bed skips the night</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={onePlayerSleep}
                onChange={(e) => setOnePlayerSleep(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Disable Mob Griefing */}
            <div className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-white block">Anti-Creeper / Mob Griefing</span>
                  <span className="text-[10px] text-slate-400">Prevent Creeper/Enderman block damage</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={disableMobGriefing}
                onChange={(e) => setDisableMobGriefing(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Disable Fire Spread */}
            <div className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-white block">Disable Fire Spread</span>
                  <span className="text-[10px] text-slate-400">Prevent fire from spreading to wood</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={disableFireSpread}
                onChange={(e) => setDisableFireSpread(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Core Gameplay Card */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Swords className="w-4 h-4 text-emerald-400" />
            <span>Gameplay & Rules</span>
          </h3>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Difficulty</label>
            <select
              value={properties.difficulty || 'normal'}
              onChange={(e) => setProperties({ ...properties, difficulty: e.target.value as any })}
              className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="peaceful">Peaceful (No monsters, auto-regen)</option>
              <option value="easy">Easy</option>
              <option value="normal">Normal (Default)</option>
              <option value="hard">Hard (Monsters deal full damage)</option>
            </select>
          </div>

          {/* Gamemode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Default Gamemode</label>
            <select
              value={properties.gamemode || 'survival'}
              onChange={(e) => setProperties({ ...properties, gamemode: e.target.value as any })}
              className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="survival">Survival</option>
              <option value="creative">Creative</option>
              <option value="adventure">Adventure</option>
              <option value="spectator">Spectator</option>
            </select>
          </div>

          {/* PvP Toggle */}
          <div className="flex items-center justify-between p-3 bg-obsidian-950/60 rounded-xl border border-white/5">
            <div>
              <span className="text-xs font-semibold text-white block">PvP (Player vs Player)</span>
              <span className="text-[11px] text-slate-400">Allow players to damage each other</span>
            </div>
            <input
              type="checkbox"
              checked={properties.pvp !== false}
              onChange={(e) => setProperties({ ...properties, pvp: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Allow Flight */}
          <div className="flex items-center justify-between p-3 bg-obsidian-950/60 rounded-xl border border-white/5">
            <div>
              <span className="text-xs font-semibold text-white block">Allow Flight</span>
              <span className="text-[11px] text-slate-400">Prevent kick for flying in survival / elytra</span>
            </div>
            <input
              type="checkbox"
              checked={properties['allow-flight'] !== false}
              onChange={(e) => setProperties({ ...properties, 'allow-flight': e.target.checked })}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* World & Performance Tuning */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span>World & Limits</span>
          </h3>

          {/* Max Players */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Max Player Slots</label>
            <input
              type="number"
              min={1}
              max={500}
              value={properties['max-players'] || 20}
              onChange={(e) =>
                setProperties({ ...properties, 'max-players': parseInt(e.target.value, 10) || 20 })
              }
              className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* View Distance Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>View Distance (Chunks): {properties['view-distance'] || 10}</span>
              <span className="text-emerald-400 font-mono">{properties['view-distance'] || 10} Chunks</span>
            </div>
            <input
              type="range"
              min={4}
              max={32}
              value={properties['view-distance'] || 10}
              onChange={(e) =>
                setProperties({ ...properties, 'view-distance': parseInt(e.target.value, 10) })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500">Higher values increase RAM/CPU requirements.</span>
          </div>

          {/* Simulation Distance */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>Simulation Distance: {properties['simulation-distance'] || 10}</span>
              <span className="text-emerald-400 font-mono">{properties['simulation-distance'] || 10} Chunks</span>
            </div>
            <input
              type="range"
              min={4}
              max={16}
              value={properties['simulation-distance'] || 10}
              onChange={(e) =>
                setProperties({ ...properties, 'simulation-distance': parseInt(e.target.value, 10) })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Whitelist Switch */}
          <div className="flex items-center justify-between p-3 bg-obsidian-950/60 rounded-xl border border-white/5">
            <div>
              <span className="text-xs font-semibold text-white block">Whitelist Enforced</span>
              <span className="text-[11px] text-slate-400">Only approved players can join</span>
            </div>
            <input
              type="checkbox"
              checked={properties['white-list'] === true}
              onChange={(e) => setProperties({ ...properties, 'white-list': e.target.checked })}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

        {/* MOTD (Message of the Day) */}
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white">Server MOTD (Message of the Day)</h3>
          <input
            type="text"
            value={properties.motd || ''}
            onChange={(e) => setProperties({ ...properties, motd: e.target.value })}
            placeholder="A Minecraft Server"
            className="w-full px-4 py-3 bg-obsidian-950 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-emerald-500"
          />
          <div className="bg-obsidian-950/90 p-3 rounded-lg border border-white/5 text-xs">
            <span className="text-slate-400 block mb-1">In-Game Server List Preview:</span>
            <span className="font-mono text-emerald-400 font-bold">{properties.motd || 'A Minecraft Server'}</span>
          </div>
        </div>
        </>
      ) : (
        /* Performance & RAM Section */
        <div className="space-y-6">
          {/* RAM Allocation Slider Card */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Allocated Memory (RAM)</h3>
                  <p className="text-xs text-slate-400">Controls heap size (-Xms and -Xmx)</p>
                </div>
              </div>
              <div className="text-xl font-extrabold text-emerald-400 font-mono">
                {ramGb} GB
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min={2}
                max={32}
                step={1}
                value={ramGb}
                onChange={(e) => setRamGb(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-obsidian-950 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>2 GB (Budget)</span>
                <span>4 GB (Standard SMP)</span>
                <span>8 GB (Heavy Plugins/World)</span>
                <span>16+ GB (Large Network)</span>
              </div>
            </div>
          </div>

          {/* JVM Flags Optimization */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Aikar's G1GC Garbage Collection Flags</h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Pre-configured JVM garbage collector parameters that eliminate tick lag and GC stutter.
                </p>
              </div>

              <input
                type="checkbox"
                checked={useAikar}
                onChange={(e) => setUseAikar(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Java Runtime Selector */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 p-1.5">
                <JavaIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Java Runtime Binary</h3>
                <p className="text-xs text-slate-400">Select JVM installation used to launch server</p>
              </div>
            </div>

            <select
              value={selectedJava}
              onChange={(e) => setSelectedJava(e.target.value)}
              className="w-full px-4 py-2.5 bg-obsidian-950 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            >
              {javaRuntimes.length > 0 ? (
                javaRuntimes.map((j) => (
                  <option key={j.path} value={j.path}>
                    {j.version ? `Java ${j.majorVersion} (${j.version})` : 'System Java'} — {j.path}
                  </option>
                ))
              ) : (
                <option value="java">Default System Java (PATH)</option>
              )}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
