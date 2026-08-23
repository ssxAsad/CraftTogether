import React, { useState, useEffect, useMemo } from 'react';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { PlayItIcon, JavaIcon } from '../common/Icons';
import { useServer } from '../../context/ServerContext';
import { useNetwork } from '../../context/NetworkContext';
import { useDialog } from '../../context/DialogContext';
import { ServerSoftwareType, NetworkMode } from '../../types';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'basic' | 'performance' | 'crossplay' | 'cracked' | 'network' | 'plugins';

export const CreateServerModal: React.FC<CreateServerModalProps> = ({ isOpen, onClose }) => {
  const { servers, createServer, isDownloading, downloadProgress, javaRuntimes, refreshServers } = useServer();
  const { upnpStatus } = useNetwork();
  const { showAlert } = useDialog();

  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<{ step: string; percent: number; details: string } | null>(null);

  // 1. Basic Info
  const [name, setName] = useState('My Minecraft PlaceholderIcon');
  const [software, setSoftware] = useState<ServerSoftwareType>('paper');
  const [version, setVersion] = useState('26.2');
  const [availableVersions, setAvailableVersions] = useState<string[]>([
    '26.2', '26.1.2', '26.1.1',
    '1.21.11', '1.21.4', '1.21.1', '1.20.4', '1.19.4', '1.18.2', '1.16.5', '1.12.2'
  ]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // 2. RAM & Performance
  const [ramGb, setRamGb] = useState(4);
  const [useAikarFlags, setUseAikarFlags] = useState(true);
  const [selectedJava, setSelectedJava] = useState<string>('');

  // 3. Cross-Play (GeyserMC)
  const [enableCrossplay, setEnableCrossplay] = useState(true);
  const [bedrockPort, setBedrockPort] = useState(19132);
  const [authType, setAuthType] = useState<'floodgate' | 'online' | 'offline'>('floodgate');

  // 4. Gameplay Rules & Features
  const [isCracked, setIsCracked] = useState(false);
  const [keepInventory, setKeepInventory] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [onePlayerSleep, setOnePlayerSleep] = useState(true);
  const [disableMobGriefing, setDisableMobGriefing] = useState(false);
  const [disableFireSpread, setDisableFireSpread] = useState(false);
  const [difficulty, setDifficulty] = useState('normal');
  const [gamemode, setGamemode] = useState('survival');
  const [pvp, setPvp] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(20);
  const [motd, setMotd] = useState('A Craftora Minecraft PlaceholderIcon');

  // 5. Network Sharing (Cloud Relay, Direct UPnP, Only LAN)
  const [networkMode, setNetworkMode] = useState<NetworkMode>('cloud_relay');

  // 6. Pre-installed Plugins
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>(['skinsrestorer', 'viaversion']);

  // Check for duplicate server name or directory
  const isNameDuplicate = useMemo(() => {
    if (!name.trim()) return false;
    const cleanId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return servers.some(
      s => s.name.trim().toLowerCase() === name.trim().toLowerCase() || s.id.toLowerCase() === cleanId
    );
  }, [name, servers]);

  // Clean reset every time the modal is opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('basic');
      setIsCreating(false);
      setCreationStatus(null);

      // Generate a fresh unique candidate name
      const baseName = 'My Minecraft PlaceholderIcon';
      let candidate = baseName;
      let count = 1;
      while (servers.some(s => s.name.trim().toLowerCase() === candidate.toLowerCase())) {
        count++;
        candidate = `${baseName} ${count}`;
      }
      setName(candidate);
      setSoftware('paper');
      setRamGb(4);
      setUseAikarFlags(true);
      setEnableCrossplay(true);
      setIsCracked(false);
      setKeepInventory(true);
      setShowCoordinates(true);
      setOnePlayerSleep(true);
      setDisableMobGriefing(false);
      setDisableFireSpread(false);
      setNetworkMode('cloud_relay');
      setSelectedPlugins(['skinsrestorer', 'viaversion']);
    }
  }, [isOpen, servers]);

  useEffect(() => {
    if (!upnpStatus.isSupported && networkMode === 'upnp') {
      setNetworkMode('cloud_relay');
    }
  }, [upnpStatus.isSupported, networkMode]);

  useEffect(() => {
    const fetchVersions = async () => {
      setLoadingVersions(true);
      if (window.electronAPI) {
        try {
          const vers = await window.electronAPI.getSoftwareVersions(software);
          if (vers && vers.length > 0) {
            setAvailableVersions(vers);
            setVersion(vers[0]);
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLoadingVersions(false);
    };
    fetchVersions();
  }, [software]);

  useEffect(() => {
    if (javaRuntimes.length > 0) {
      setSelectedJava(javaRuntimes[0].path);
    }
  }, [javaRuntimes]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim() || isNameDuplicate || isCreating) return;
    setIsCreating(true);

    try {
      const cleanId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

      setCreationStatus({
        step: 'Downloading PlaceholderIcon Core',
        percent: 10,
        details: `Downloading ${software.toUpperCase()} ${version} engine jar...`
      });

      // 2. Create the server instance & download jar
      await createServer({
        name: name.trim(),
        serverSoftware: software,
        version,
        allocatedRamGb: ramGb,
        javaPath: selectedJava,
        useAikarFlags,
        port: 25565,
        isCracked,
        networkMode,
        keepInventory,
        showCoordinates,
        onePlayerSleep,
        disableMobGriefing,
        disableFireSpread
      });

      // 3. Configure properties
      if (window.electronAPI) {
        setCreationStatus({
          step: 'Configuring PlaceholderIcon Settings',
          percent: 55,
          details: 'Applying gameplay configuration and network ports...'
        });

        await window.electronAPI.writeProperties({
          serverId: cleanId,
          properties: {
            'server-port': 25565,
            'online-mode': !isCracked,
            'difficulty': difficulty,
            'gamemode': gamemode,
            'pvp': pvp,
            'max-players': maxPlayers,
            'motd': motd
          }
        });

        // 4. Install GeyserMC if selected
        if (enableCrossplay) {
          setCreationStatus({
            step: 'Setting Up Cross-Play',
            percent: 70,
            details: 'Configuring GeyserMC & Floodgate Bedrock bridge...'
          });

          await window.electronAPI.installGeyser(cleanId);
          await window.electronAPI.saveGeyserConfig({
            serverId: cleanId,
            config: {
              bedrockPort,
              bedrockAddress: '0.0.0.0',
              authType,
              motd1: name,
              motd2: 'Java + Bedrock Cross-Play',
              passthroughMotd: true,
              passthroughMaxPlayers: true
            }
          });
        }

        // 5. Install selected plugins with live step updates
        const pluginsToInstall = selectedPlugins.filter(p => p !== 'skinsrestorer' || isCracked);
        if (pluginsToInstall.length > 0) {
          for (let i = 0; i < pluginsToInstall.length; i++) {
            const pluginId = pluginsToInstall[i];
            const currentPct = 75 + Math.round(((i + 1) / pluginsToInstall.length) * 20);
            setCreationStatus({
              step: `Installing Plugin: ${pluginId}`,
              percent: currentPct,
              details: `Setting up ${pluginId} (${i + 1}/${pluginsToInstall.length})...`
            });

            try {
              await window.electronAPI.installPlugin({ serverId: cleanId, pluginId });
            } catch (e) {
              console.warn(`Could not pre-install plugin ${pluginId}`, e);
            }
          }
        }

        setCreationStatus({
          step: 'Finalizing Setup',
          percent: 100,
          details: 'PlaceholderIcon created successfully!'
        });

        await refreshServers();
      }

      setTimeout(() => {
        setIsCreating(false);
        setCreationStatus(null);
        onClose();
      }, 400);

    } catch (err) {
      setIsCreating(false);
      setCreationStatus(null);
      await showAlert('Create PlaceholderIcon Error', `Error creating server: ${err}`, 'warning');
    }
  };

  const steps = [
    { id: 'basic', label: '1. Engine', icon: PlaceholderIcon },
    { id: 'performance', label: '2. RAM & JVM', icon: PlaceholderIcon },
    { id: 'crossplay', label: '3. Cross-Play', icon: PlaceholderIcon },
    { id: 'cracked', label: '4. Gameplay', icon: PlaceholderIcon },
    { id: 'network', label: '5. Network', icon: PlaceholderIcon },
    { id: 'plugins', label: '6. Plugins', icon: PlaceholderIcon },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 text-slate-200 flex items-center justify-center border border-white/10">
              <PlaceholderIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Create New Minecraft PlaceholderIcon</h2>
              <p className="text-xs text-slate-400">Complete setup wizard with cross-play, RAM, & networking</p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isCreating || isDownloading}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition disabled:opacity-30"
          >
            <PlaceholderIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-obsidian-900 border-b border-white/5 overflow-x-auto">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                disabled={isCreating || isDownloading}
                onClick={() => setCurrentStep(step.id as WizardStep)}
                className={`flex items-center gap-1.5 px-3 py-2 leading-none rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-white/5 text-white border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Multi-Stage Creation & PlaceholderIcon Progress Banner */}
        {(isCreating || isDownloading || creationStatus) && (
          <div className="bg-obsidian-950 border-b border-white/10 p-4 space-y-2.5 animate-in fade-in duration-300">
            <div className="flex justify-between items-center text-xs font-bold text-white">
              <span className="flex items-center gap-2">
                <PlaceholderIcon className="w-4 h-4 animate-spin text-slate-200" />
                <span>{creationStatus?.step || (downloadProgress ? `Downloading ${downloadProgress.software.toUpperCase()} ${downloadProgress.version}` : 'Creating PlaceholderIcon Instance...')}</span>
              </span>
              <span className="font-mono text-slate-200">{creationStatus?.percent || downloadProgress?.percent || 0}%</span>
            </div>
            <div className="w-full h-2 bg-obsidian-950 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${creationStatus?.percent || downloadProgress?.percent || 0}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {creationStatus?.details || (downloadProgress ? `Downloading engine jar: ${downloadProgress.percent}%` : 'Setting up server environment...')}
            </p>
          </div>
        )}

        {/* Wizard Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* STEP 1: Basic Info & Engine */}
          {currentStep === 'basic' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">PlaceholderIcon Name</label>
                  {isNameDuplicate && (
                    <span className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                      <PlaceholderIcon className="w-3 h-3" />
                      Name already in use
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  disabled={isCreating}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Friends Survival SMP"
                  className={`w-full px-4 py-2.5 bg-obsidian-950 border rounded-xl text-xs text-white focus:outline-none transition ${
                    isNameDuplicate
                      ? 'border-red-500/70 bg-red-950/20 text-red-100 focus:border-red-500'
                      : 'border-white/10 focus:border-white/10'
                  }`}
                />
                {isNameDuplicate && (
                  <p className="text-[11px] text-red-400/90 leading-tight">
                    A server with this name already exists. Please choose a different name.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">PlaceholderIcon Engine (Software)</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'paper', label: 'PaperMC (Recommended)', desc: 'High performance + Plugins + GeyserMC' },
                    { id: 'purpur', label: 'PurpurMC', desc: 'Highly customizable Paper fork' },
                    { id: 'fabric', label: 'Fabric', desc: 'Lightweight modern modded engine' },
                    { id: 'vanilla', label: 'Vanilla Mojang', desc: 'Standard un-modded server' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSoftware(item.id as ServerSoftwareType)}
                      className={`p-3 rounded-xl text-left border transition ${
                        software === item.id
                          ? 'bg-white/5 border-white/10 text-white'
                          : 'bg-obsidian-900 border-white/5 text-slate-400 hover:border-white/15'
                      }`}
                    >
                      <strong className="block text-xs text-white font-bold">{item.label}</strong>
                      <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Minecraft Version</label>
                  {version.startsWith('26') && (
                    <span className="text-[10px] text-slate-200 font-mono">Requires Java 25 (auto-handled)</span>
                  )}
                </div>
                <select
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  disabled={loadingVersions}
                  className="w-full px-4 py-2.5 bg-obsidian-950 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-white/10"
                >
                  {availableVersions.map((v) => (
                    <option key={v} value={v}>
                      Minecraft {v} {v.startsWith('26') ? '(Java 25+)' : v === '1.21.4' ? '(Recommended · Stable)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Performance & RAM */}
          {currentStep === 'performance' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Dedicated PlaceholderIcon RAM:</span>
                  <span className="text-slate-200 font-mono font-bold text-sm">{ramGb} GB</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={1}
                  value={ramGb}
                  onChange={(e) => setRamGb(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-obsidian-950 rounded-lg"
                />
                <div className="flex gap-2 pt-1">
                  {[2, 4, 6, 8, 12, 16].map((gb) => (
                    <button
                      key={gb}
                      type="button"
                      onClick={() => setRamGb(gb)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                        ramGb === gb ? 'bg-emerald-500 text-obsidian-950' : 'bg-obsidian-950 text-slate-400'
                      }`}
                    >
                      {gb}G
                    </button>
                  ))}
                </div>
              </div>

              {/* Aikar Flags Switch */}
              <div className="flex items-center justify-between p-3 bg-obsidian-950/60 rounded-xl border border-white/5">
                <div>
                  <span className="text-xs font-bold text-white block">Enable Aikar's Optimized G1GC Flags</span>
                  <span className="text-[10px] text-slate-400">Eliminates GC lag spikes during gameplay</span>
                </div>
                <input
                  type="checkbox"
                  checked={useAikarFlags}
                  onChange={(e) => setUseAikarFlags(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Java Version */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <JavaIcon className="w-4 h-4" />
                  <span>Java Runtime Environment</span>
                </label>
                <select
                  value={selectedJava}
                  onChange={(e) => setSelectedJava(e.target.value)}
                  className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-white/10"
                >
                  {javaRuntimes.map((j) => (
                    <option key={j.path} value={j.path}>
                      Java {j.majorVersion} ({j.vendor}) — {j.path}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* STEP 3: Cross-Play (GeyserMC) */}
          {currentStep === 'crossplay' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-obsidian-950/60 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <PlaceholderIcon className="w-5 h-5 text-slate-200" />
                  <div>
                    <span className="text-xs font-bold text-white block">Enable GeyserMC + Floodgate</span>
                    <span className="text-[10px] text-slate-400">Bedrock (mobile, console, Windows 10/11) players can join</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableCrossplay}
                  onChange={(e) => setEnableCrossplay(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {enableCrossplay && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Bedrock Port (UDP)</label>
                    <input
                      type="number"
                      value={bedrockPort}
                      onChange={(e) => setBedrockPort(parseInt(e.target.value, 10) || 19132)}
                      className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs font-mono text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Bedrock Auth Mode</label>
                    <select
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white"
                    >
                      <option value="floodgate">Floodgate (No Java MC account needed)</option>
                      <option value="online">Online Mode (Mojang Account)</option>
                      <option value="offline">Offline / Cracked</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Gameplay Rules & Features */}
          {currentStep === 'cracked' && (
            <div className="space-y-4">
              {/* Gameplay Gamerules Section */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Popular Gameplay Enhancements
                </span>
                
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Keep Inventory */}
                  <div 
                    onClick={() => setKeepInventory(!keepInventory)}
                    className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition"
                  >
                    <div className="flex items-center gap-3">
                      <PlaceholderIcon className="w-5 h-5 text-slate-200 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-white block">Keep Inventory on Death</span>
                        <span className="text-[10px] text-slate-400">Never lose items, tools, armor, or XP upon dying</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={keepInventory}
                      onChange={(e) => setKeepInventory(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer pointer-events-none"
                    />
                  </div>

                  {/* Show Coordinates */}
                  <div 
                    onClick={() => setShowCoordinates(!showCoordinates)}
                    className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition"
                  >
                    <div className="flex items-center gap-3">
                      <PlaceholderIcon className="w-5 h-5 text-slate-200 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-white block">Show Coordinates HUD</span>
                        <span className="text-[10px] text-slate-400">Live on-screen PlaceholderIcon, Y, Z coordinates for Bedrock & Java players</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={showCoordinates}
                      onChange={(e) => setShowCoordinates(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer pointer-events-none"
                    />
                  </div>

                  {/* 1-Player Sleep */}
                  <div 
                    onClick={() => setOnePlayerSleep(!onePlayerSleep)}
                    className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition"
                  >
                    <div className="flex items-center gap-3">
                      <PlaceholderIcon className="w-5 h-5 text-slate-200 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-white block">Instant 1-Player Sleep</span>
                        <span className="text-[10px] text-slate-400">Only 1 player needs to sleep in bed to skip the night</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={onePlayerSleep}
                      onChange={(e) => setOnePlayerSleep(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer pointer-events-none"
                    />
                  </div>

                  {/* Disable Mob Griefing */}
                  <div 
                    onClick={() => setDisableMobGriefing(!disableMobGriefing)}
                    className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition"
                  >
                    <div className="flex items-center gap-3">
                      <PlaceholderIcon className="w-5 h-5 text-slate-200 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-white block">Anti-Creeper / Mob Griefing</span>
                        <span className="text-[10px] text-slate-400">Prevent Creeper explosions and Endermen from breaking blocks</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={disableMobGriefing}
                      onChange={(e) => setDisableMobGriefing(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer pointer-events-none"
                    />
                  </div>

                  {/* Disable Fire Spread */}
                  <div 
                    onClick={() => setDisableFireSpread(!disableFireSpread)}
                    className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/10 cursor-pointer hover:border-white/20 transition"
                  >
                    <div className="flex items-center gap-3">
                      <PlaceholderIcon className="w-5 h-5 text-slate-200 shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-white block">Disable Fire Spread</span>
                        <span className="text-[10px] text-slate-400">Prevent accidental fires from burning down wooden builds</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={disableFireSpread}
                      onChange={(e) => setDisableFireSpread(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Launcher Access & World Defaults */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Launcher Access & World Defaults
                </span>

                <div className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <PlaceholderIcon className="w-5 h-5 text-slate-200 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">Cracked (Offline Mode) Support</span>
                      <span className="text-[10px] text-slate-400">Allows non-premium accounts (TLauncher, SKLauncher, Prism) + auto SkinsRestorer</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isCracked}
                    onChange={(e) => setIsCracked(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white"
                    >
                      <option value="peaceful">Peaceful</option>
                      <option value="easy">Easy</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Gamemode</label>
                    <select
                      value={gamemode}
                      onChange={(e) => setGamemode(e.target.value)}
                      className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white"
                    >
                      <option value="survival">Survival</option>
                      <option value="creative">Creative</option>
                      <option value="adventure">Adventure</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-obsidian-950/60 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <PlaceholderIcon className="w-5 h-5 text-slate-200 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">PvP (Player vs Player)</span>
                      <span className="text-[10px] text-slate-400">Allow players to attack and damage each other</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={pvp}
                    onChange={(e) => setPvp(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">PlaceholderIcon MOTD</label>
                  <input
                    type="text"
                    value={motd}
                    onChange={(e) => setMotd(e.target.value)}
                    className="w-full px-3 py-2 bg-obsidian-950 border border-white/10 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Network Sharing (3 Options) */}
          {currentStep === 'network' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Choose PlaceholderIcon Networking & Sharing Mode</label>
                <p className="text-[11px] text-slate-400">
                  Select how players will connect to this Minecraft server. You can change this anytime later.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: PlayIt.gg Tunnel */}
                <div
                  onClick={() => setNetworkMode('cloud_relay')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    networkMode === 'cloud_relay'
                      ? 'bg-white/5 border-white/10 text-white'
                      : 'bg-obsidian-900 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center p-1.5 shadow-sm shrink-0">
                        <PlayItIcon className="w-9 h-9 rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-white">PlayIt.gg Tunnel (Recommended)</strong>
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-white/5 text-white border border-white/10">
                            Universal Internet Play
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Play online with friends worldwide. Bypasses CGNAT & strict firewalls with zero router port forwarding.
                        </p>
                      </div>
                    </div>

                    <input
                      type="radio"
                      name="networkMode"
                      checked={networkMode === 'cloud_relay'}
                      onChange={() => setNetworkMode('cloud_relay')}
                      className="mt-1 w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Option 2: Direct UPnP */}
                <div
                  onClick={() => {
                    if (upnpStatus.isSupported) {
                      setNetworkMode('upnp');
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all ${
                    !upnpStatus.isSupported
                      ? 'bg-obsidian-950/60 border-red-500/20 opacity-60 cursor-not-allowed'
                      : networkMode === 'upnp'
                      ? 'bg-white/5 border-white/10 text-white cursor-pointer'
                      : 'bg-obsidian-900 border-white/5 hover:border-white/15 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          !upnpStatus.isSupported
                            ? 'bg-red-500/10 text-red-400'
                            : networkMode === 'upnp'
                            ? 'bg-emerald-500 text-obsidian-950'
                            : 'bg-white/5 text-slate-200'
                        }`}
                      >
                        {!upnpStatus.isSupported ? <PlaceholderIcon className="w-4 h-4" /> : <PlaceholderIcon className="w-4 h-4" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-white">Direct UPnP Port Forward</strong>
                          {upnpStatus.isSupported ? (
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-obsidian-950 text-white border border-white/10">
                              0ms Added Ping
                            </span>
                          ) : (
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-500/30">
                              Unsupported by Gateway
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {upnpStatus.isSupported
                            ? 'Direct connection via automated router port mapping (lowest latency).'
                            : 'Your local network gateway or ISP does not support UPnP IGD automatic port mapping. Please select PlayIt.gg Tunnel or Local LAN.'}
                        </p>
                      </div>
                    </div>

                    <input
                      type="radio"
                      name="networkMode"
                      disabled={!upnpStatus.isSupported}
                      checked={networkMode === 'upnp'}
                      onChange={() => {
                        if (upnpStatus.isSupported) setNetworkMode('upnp');
                      }}
                      className={`mt-1 w-4 h-4 accent-emerald-500 ${
                        !upnpStatus.isSupported ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                      }`}
                    />
                  </div>
                </div>

                {/* Option 3: Only Lan */}
                <div
                  onClick={() => setNetworkMode('lan_only')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    networkMode === 'lan_only'
                      ? 'bg-white/5 border-white/10 text-white'
                      : 'bg-obsidian-900 border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${networkMode === 'lan_only' ? 'bg-emerald-500 text-obsidian-950' : 'bg-white/5 text-slate-300'}`}>
                        <PlaceholderIcon className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-white">Only Local LAN</strong>
                          <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50">
                            Offline / Same Wi-Fi
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Offline mode for friends connected to your same Wi-Fi or local network.
                        </p>
                      </div>
                    </div>

                    <input
                      type="radio"
                      name="networkMode"
                      checked={networkMode === 'lan_only'}
                      onChange={() => setNetworkMode('lan_only')}
                      className="mt-1 w-4 h-4 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Pre-installed Plugins */}
          {currentStep === 'plugins' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Recommended Starter Plugins</h3>
                <p className="text-xs text-slate-400">
                  Select essential plugins to auto-install during server setup.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    id: 'skinsrestorer',
                    name: 'SkinsRestorer (Crucial for Cracked)',
                    desc: 'Restores player skins for offline/cracked and Bedrock crossplay players automatically.'
                  },
                  {
                    id: 'viaversion',
                    name: 'ViaVersion (Multi-Version Protocol)',
                    desc: 'Allows newer and older Minecraft clients to join this server without version restrictions.'
                  },
                  {
                    id: 'essentialsx',
                    name: 'EssentialsX (Economy & Teleports)',
                    desc: 'Adds /spawn, /tpa, /home, /sethome, /warp, /back and basic SMP server utility commands.'
                  },
                  {
                    id: 'chunky',
                    name: 'Chunky (World Pre-Generator)',
                    desc: 'Pre-generates chunks to permanently eliminate player exploration lag and TPS drops.'
                  }
                ].map((item) => {
                  const isChecked = selectedPlugins.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isChecked) setSelectedPlugins(selectedPlugins.filter(x => x !== item.id));
                        else setSelectedPlugins([...selectedPlugins, item.id]);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                        isChecked
                          ? 'bg-white/5 border-white/10'
                          : 'bg-obsidian-900 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <strong className="block text-xs text-white">{item.name}</strong>
                        <span className="text-[11px] text-slate-400 block">{item.desc}</span>
                      </div>

                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-4 h-4 accent-emerald-500 cursor-pointer ml-3"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-obsidian-950/80">
          <div>
            {currentStep !== 'basic' && (
              <button
                type="button"
                disabled={isCreating}
                onClick={() => {
                  const idx = steps.findIndex(s => s.id === currentStep);
                  if (idx > 0) setCurrentStep(steps[idx - 1].id as WizardStep);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition"
              >
                <PlaceholderIcon className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep !== 'plugins' ? (
              <button
                type="button"
                disabled={isCreating || (currentStep === 'basic' && (isNameDuplicate || !name.trim()))}
                onClick={() => {
                  const idx = steps.findIndex(s => s.id === currentStep);
                  if (idx < steps.length - 1) setCurrentStep(steps[idx + 1].id as WizardStep);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold border border-white/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next Step</span>
                <PlaceholderIcon className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating || isDownloading || isNameDuplicate || !name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 font-bold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? <PlaceholderIcon className="w-4 h-4 animate-spin" /> : <PlaceholderIcon className="w-4 h-4" />}
                <span>{isCreating ? 'Setting Up PlaceholderIcon...' : 'Create & Launch PlaceholderIcon'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
