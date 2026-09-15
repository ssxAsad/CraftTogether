import React, { useState, useEffect } from 'react';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { ServerProperties } from '../../types';
import { GlassCard } from '../common/GlassCard';

export const ConfigTab: React.FC = () => {
  const { activeServer, javaRuntimes, status } = useServerState();
  const { updateServerConfig, refreshServers, sendCommand, loadJavaRuntimes } = useServerActions();
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
  const [disableMobGriefing, setDisableMobGriefing] = useState(activeServer?.disableMobGriefing === true);
  const [disableFireSpread, setDisableFireSpread] = useState(activeServer?.disableFireSpread === true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load Java Runtimes explicitly when opening the Config Tab
    if (javaRuntimes.length === 0) {
      loadJavaRuntimes();
    }
  }, [javaRuntimes.length, loadJavaRuntimes]);

  useEffect(() => {
    const loadProps = async () => {
      if (!activeServer) return;
      setRamGb(activeServer.allocatedRamGb || 4);
      setUseAikar(activeServer.useAikarFlags !== false);
      setSelectedJava(activeServer.javaPath || javaRuntimes[0]?.path || 'java');
      setKeepInventory(activeServer.keepInventory !== false);
      setShowCoordinates(activeServer.showCoordinates !== false);
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
        disableMobGriefing,
        disableFireSpread
      });

      // If server is currently running, dispatch real-time gamerules to server console
      if (status === 'ONLINE') {
        await sendCommand(`gamerule keepInventory ${keepInventory ? 'true' : 'false'}`);
        await sendCommand(`gamerule showCoordinates ${showCoordinates ? 'true' : 'false'}`);
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
          <div>
            <h1 className="text-xl font-bold text-content-primary">Server Settings & Configuration</h1>
            <p className="text-xs text-content-secondary">
              Manage gameplay properties, cracked mode, dedicated RAM, and Java runtime
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Section Pills */}
          <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-border-default">
            <button
              onClick={() => setActiveSection('game')}
              className={`flex items-center gap-1.5 px-3 py-2 leading-none rounded-md text-xs font-semibold transition ${
                activeSection === 'game'
                  ? 'bg-success text-white shadow-sm font-bold border-transparent'
                  : 'text-content-secondary hover:text-content-primary border border-transparent'
              }`}
            >
              <span>Gameplay & World</span>
            </button>
            <button
              onClick={() => setActiveSection('performance')}
              className={`flex items-center gap-1.5 px-3 py-2 leading-none rounded-md text-xs font-semibold transition ${
                activeSection === 'performance'
                  ? 'bg-success text-white shadow-sm font-bold border-transparent'
                  : 'text-content-secondary hover:text-content-primary border border-transparent'
              }`}
            >
              <span>RAM & Performance</span>
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 bg-success hover:bg-success/80 text-white rounded-lg font-bold text-xs transition"
          >
            <span>{saveSuccess ? 'Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {activeSection === 'game' ? (
        <>
          {/* Featured: Cracked / Online Mode Switcher Card */}
          <GlassCard className="rounded-xl p-6 border-border-default space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-content-primary">Authentication Mode</h2>
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-warning-bg text-warning-fg border-warning-fg/20"
                  >
                    {isCracked ? 'Cracked Allowed' : 'Premium Only'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-surface-elevated p-1 rounded-lg border border-border-default">
                <button
                  type="button"
                  onClick={() => handleToggleCracked(false)}
                  className={`px-3 py-2 leading-none rounded-md text-xs font-semibold transition ${
                    !isCracked
                      ? 'bg-success text-white font-bold'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                >
                  Premium Only
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleCracked(true)}
                  className={`px-3 py-2 leading-none rounded-md text-xs font-semibold transition ${
                    isCracked
                      ? 'bg-success text-white font-bold'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                >
                  Cracked & Premium
                </button>
              </div>
            </div>


          </GlassCard>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Popular Gameplay Enhancements (Gamerules) Card */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-4 md:col-span-2">
          <h3 className="text-sm font-bold text-content-primary flex items-center gap-2 border-b border-border-subtle pb-3">
            <span>Game Rules</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Keep Inventory */}
            <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-content-primary block">Keep Inventory</span>
                  <span className="text-[10px] text-content-secondary">Keep items & XP upon dying</span>
                </div>
              </div>
              <button
                onClick={() => setKeepInventory(!keepInventory)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${keepInventory ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${keepInventory ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Show Coordinates */}
            <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-content-primary block">Show Coordinates HUD</span>
                  <span className="text-[10px] text-content-secondary">Live X, Y, Z on screen for Bedrock & Java</span>
                </div>
              </div>
              <button
                onClick={() => setShowCoordinates(!showCoordinates)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${showCoordinates ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showCoordinates ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Disable Mob Griefing */}
            <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-content-primary block">Anti-Creeper / Mob Griefing</span>
                  <span className="text-[10px] text-content-secondary">Prevent Creeper/Enderman block damage</span>
                </div>
              </div>
              <button
                onClick={() => setDisableMobGriefing(!disableMobGriefing)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${disableMobGriefing ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${disableMobGriefing ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Disable Fire Spread */}
            <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-content-primary block">Disable Fire Spread</span>
                  <span className="text-[10px] text-content-secondary">Prevent fire from spreading to wood</span>
                </div>
              </div>
              <button
                onClick={() => setDisableFireSpread(!disableFireSpread)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${disableFireSpread ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${disableFireSpread ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Core Gameplay Card */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
          <h3 className="text-sm font-bold text-content-primary flex items-center gap-2 border-b border-border-subtle pb-3">
            <span>Gameplay & Rules</span>
          </h3>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Difficulty</label>
            <select
              value={properties.difficulty || 'normal'}
              onChange={(e) => setProperties({ ...properties, difficulty: e.target.value as any })}
              className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary focus:outline-none focus:border-border-default"
            >
              <option value="peaceful">Peaceful (No monsters, auto-regen)</option>
              <option value="easy">Easy</option>
              <option value="normal">Normal (Default)</option>
              <option value="hard">Hard (Monsters deal full damage)</option>
            </select>
          </div>

          {/* Gamemode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Default Gamemode</label>
            <select
              value={properties.gamemode || 'survival'}
              onChange={(e) => setProperties({ ...properties, gamemode: e.target.value as any })}
              className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary focus:outline-none focus:border-border-default"
            >
              <option value="survival">Survival</option>
              <option value="creative">Creative</option>
              <option value="adventure">Adventure</option>
              <option value="spectator">Spectator</option>
            </select>
          </div>

          {/* PvP Toggle */}
          <div className="flex items-center justify-between p-3 bg-surface-base rounded-xl border border-border-subtle">
            <div>
              <span className="text-xs font-semibold text-content-primary block">PvP (Player vs Player)</span>
              <span className="text-[11px] text-content-secondary">Allow players to damage each other</span>
            </div>
            <button
              onClick={() => setProperties({ ...properties, pvp: properties.pvp === false ? true : false })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${properties.pvp !== false ? 'bg-success' : 'bg-content-muted'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${properties.pvp !== false ? 'translate-x-[18px]' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Allow Flight */}
          <div className="flex items-center justify-between p-3 bg-surface-base rounded-xl border border-border-subtle">
            <div>
              <span className="text-xs font-semibold text-content-primary block">Allow Flight</span>
              <span className="text-[11px] text-content-secondary">Prevent kick for flying in survival / elytra</span>
            </div>
            <button
              onClick={() => setProperties({ ...properties, 'allow-flight': properties['allow-flight'] === false ? true : false })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${properties['allow-flight'] !== false ? 'bg-success' : 'bg-content-muted'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${properties['allow-flight'] !== false ? 'translate-x-[18px]' : 'translate-x-1'}`} />
            </button>
          </div>
        </GlassCard>

        {/* World & Performance Tuning */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
          <h3 className="text-sm font-bold text-content-primary flex items-center gap-2 border-b border-border-subtle pb-3">
            <span>World & Limits</span>
          </h3>

          {/* Max Players */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-content-primary">Max Player Slots</label>
            <input
              type="number"
              min={1}
              max={500}
              value={properties['max-players'] || 20}
              onChange={(e) =>
                setProperties({ ...properties, 'max-players': parseInt(e.target.value, 10) || 20 })
              }
              className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
            />
          </div>

          {/* View Distance Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-content-primary">
              <span>View Distance (Chunks): {properties['view-distance'] || 10}</span>
              <span className="text-content-primary font-mono">{properties['view-distance'] || 10} Chunks</span>
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
            <span className="text-[10px] text-content-muted">Higher values increase RAM/CPU requirements.</span>
          </div>

          {/* Simulation Distance */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-content-primary">
              <span>Simulation Distance: {properties['simulation-distance'] || 10}</span>
              <span className="text-content-primary font-mono">{properties['simulation-distance'] || 10} Chunks</span>
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
          <div className="flex items-center justify-between p-3 bg-surface-base rounded-xl border border-border-subtle">
            <div>
              <span className="text-xs font-semibold text-content-primary block">Whitelist Enforced</span>
              <span className="text-[11px] text-content-secondary">Only approved players can join</span>
            </div>
            <button
              onClick={() => setProperties({ ...properties, 'white-list': properties['white-list'] === true ? false : true })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${properties['white-list'] === true ? 'bg-success' : 'bg-content-muted'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${properties['white-list'] === true ? 'translate-x-[18px]' : 'translate-x-1'}`} />
            </button>
          </div>
        </GlassCard>
      </div>

        {/* MOTD (Message of the Day) */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
          <h3 className="text-sm font-bold text-content-primary">Server Description</h3>
          <input
            type="text"
            value={properties.motd || ''}
            onChange={(e) => setProperties({ ...properties, motd: e.target.value })}
            placeholder="A Minecraft Server"
            className="w-full px-4 py-3 bg-surface-base border border-border-default rounded-xl text-sm font-mono text-content-primary focus:outline-none focus:border-border-default"
          />
        </GlassCard>
        </>
      ) : (
        /* Performance & RAM Section */
        <div className="space-y-6">
          {/* RAM Allocation Slider Card */}
          <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h3 className="text-sm font-bold text-content-primary">Allocated Memory (RAM)</h3>
                  <p className="text-xs text-content-secondary">Controls heap size (-Xms and -Xmx)</p>
                </div>
              </div>
              <div className="text-xl font-extrabold text-content-primary font-mono">
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
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-surface-base rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-content-muted font-mono">
                <span>2 GB (Budget)</span>
                <span>4 GB (Standard SMP)</span>
                <span>8 GB (Heavy Plugins/World)</span>
                <span>16+ GB (Large Network)</span>
              </div>
            </div>
          </GlassCard>

          {/* JVM Flags Optimization */}
          <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-content-primary">Aikar's G1GC Garbage Collection Flags</h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-warning-bg text-warning-fg border-warning-fg/20">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-content-secondary">
                  Pre-configured JVM garbage collector parameters that eliminate tick lag and GC stutter.
                </p>
              </div>

              <button
                onClick={() => setUseAikar(!useAikar)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${useAikar ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${useAikar ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </div>
          </GlassCard>

          {/* Java Runtime Selector */}
          <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-content-primary">Java Runtime Binary</h3>
                <p className="text-xs text-content-secondary">Select JVM installation used to launch server</p>
              </div>
            </div>

            <select
              value={selectedJava}
              onChange={(e) => setSelectedJava(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-base border border-border-default rounded-xl text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
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
          </GlassCard>
        </div>
      )}
    </div>
  );
};
