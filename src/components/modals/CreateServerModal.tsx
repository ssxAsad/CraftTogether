import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, AlertTriangle, Info } from "lucide-react";
import { PlayItIcon, JavaIcon } from '../common/Icons';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { useNetworkState, useNetworkActions } from '../../context/NetworkContext';
import { useDialog } from '../../context/DialogContext';
import { ServerSoftwareType, NetworkMode, isModdedServerSoftware } from '../../types';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WizardStep = 'basic' | 'performance' | 'crossplay' | 'cracked' | 'network' | 'plugins';

export const CreateServerModal: React.FC<CreateServerModalProps> = ({ isOpen, onClose }) => {
  const { servers, isDownloading, downloadProgress, javaRuntimes } = useServerState();
  const { createServer, refreshServers, loadJavaRuntimes } = useServerActions();
  const { upnpStatus } = useNetworkState();
  const { showAlert } = useDialog();

  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<{ step: string; percent: number; details: string } | null>(null);

  // 1. Basic Info
  const [name, setName] = useState('My Minecraft Server');
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
  const [motd, setMotd] = useState('A Craftora Minecraft Server');

  // 5. Network Sharing (Cloud Relay, Direct UPnP, Only LAN)
  const [networkMode, setNetworkMode] = useState<NetworkMode>('cloud_relay');

  // 6. Pre-installed Plugins
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>(['skinsrestorer', 'viaversion']);

  const isModded = useMemo(() => isModdedServerSoftware(software), [software]);

  // Check for duplicate server name or directory (ignore while actively creating)
  const isNameDuplicate = useMemo(() => {
    if (!name.trim() || isCreating) return false;
    const cleanId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return servers.some(
      s => s.name.trim().toLowerCase() === name.trim().toLowerCase() || s.id.toLowerCase() === cleanId
    );
  }, [name, servers, isCreating]);

  const prevIsOpenRef = useRef(false);

  // Clean reset ONLY when the modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      prevIsOpenRef.current = true;
      setCurrentStep('basic');
      setIsCreating(false);
      setCreationStatus(null);
      
      // Load Java Runtimes explicitly when creating a server
      loadJavaRuntimes();

      // Generate a fresh unique candidate name
      const baseName = 'My Minecraft Server';
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
    } else if (!isOpen) {
      prevIsOpenRef.current = false;
    }
  }, [isOpen, servers, loadJavaRuntimes]);

  // Automatically disable crossplay if a modded server is chosen
  useEffect(() => {
    if (isModded) {
      setEnableCrossplay(false);
    }
  }, [isModded]);

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
        step: 'Downloading Server Core',
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
          step: 'Configuring Server Settings',
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

        // 4. Install GeyserMC if selected (only for non-modded servers)
        if (enableCrossplay && !isModded) {
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

        // 5. Install selected plugins with live step updates (Paper/Purpur only, not modded)
        const pluginsToInstall = isModded
          ? []
          : selectedPlugins.filter(p => p !== 'skinsrestorer' || isCracked);
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
          details: 'Server created successfully!'
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
      await showAlert('Create Server Error', `Error creating server: ${err}`, 'warning');
    }
  };

  const steps = [
    { id: 'basic', label: '1. Engine' },
    { id: 'performance', label: '2. RAM & JVM' },
    { id: 'crossplay', label: '3. Cross-Play' },
    { id: 'cracked', label: '4. Gameplay' },
    { id: 'network', label: '5. Network' },
    { id: 'plugins', label: '6. Plugins' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-surface-elevated w-full max-w-2xl h-[550px] max-h-[90vh] rounded-2xl border border-border-default shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
          <div className="flex items-center">
            <h2 className="text-base font-bold text-content-primary">Create New Minecraft Server</h2>
          </div>

          <button
            onClick={onClose}
            disabled={isCreating || isDownloading}
            className="text-content-secondary hover:text-content-primary p-1 rounded-lg hover:bg-surface-hover transition disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-surface-elevated border-b border-border-subtle overflow-x-auto">
          {steps.map((step) => {
            const isActive = currentStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                disabled={isCreating || isDownloading}
                onClick={() => setCurrentStep(step.id as WizardStep)}
                className={`flex items-center gap-1.5 px-3 py-2 leading-none rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-success text-white font-bold'
                    : 'text-content-secondary hover:text-content-primary disabled:opacity-40'
                }`}
              >
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Multi-Stage Creation & Server Progress Banner */}
        {(isCreating || isDownloading || creationStatus) && (
          <div className="bg-surface-base border-b border-border-default p-4 space-y-2.5 animate-in fade-in duration-300">
            <div className="flex justify-between items-center text-xs font-bold text-content-primary">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {isDownloading && downloadProgress
                    ? `Downloading ${downloadProgress.software.toUpperCase()} ${downloadProgress.version}`
                    : creationStatus?.step || 'Setting Up Server Instance...'}
                </span>
              </span>
              <span className="font-mono text-content-primary">
                {isDownloading && downloadProgress
                  ? Math.round(downloadProgress.percent)
                  : creationStatus?.percent || 0}%
              </span>
            </div>
            <div className="w-full h-2 bg-surface-base rounded-full overflow-hidden border border-border-subtle">
              <div
                className="h-full bg-success transition-all duration-300"
                style={{
                  width: `${
                    isDownloading && downloadProgress
                      ? Math.round(downloadProgress.percent)
                      : creationStatus?.percent || 0
                  }%`,
                }}
              />
            </div>
            <p className="text-[11px] text-content-secondary font-mono truncate">
              {isDownloading && downloadProgress
                ? `Downloading engine jar: ${Math.round(downloadProgress.percent)}%`
                : creationStatus?.details || 'Preparing server environment...'}
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
                  <label className="text-xs font-semibold text-content-primary">Server Name</label>
                  {isNameDuplicate && (
                    <span className="text-[10px] text-warning-fg font-semibold flex items-center gap-1">
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
                  className={`w-full px-4 py-2.5 bg-surface-base border rounded-xl text-xs text-content-primary focus:outline-none transition ${
                    isNameDuplicate
                      ? 'border-warning-fg/20 bg-warning-bg text-warning-fg focus:border-warning-fg/20'
                      : 'border-border-default focus:border-border-hover'
                  }`}
                />
                {isNameDuplicate && (
                  <p className="text-[11px] text-warning-fg leading-tight">
                    A server with this name already exists. Please choose a different name.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-content-primary">Server Engine (Software)</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'paper', label: 'PaperMC (Recommended)', desc: 'High performance + Plugins + GeyserMC' },
                    { id: 'purpur', label: 'PurpurMC', desc: 'Highly customizable Paper fork' },
                    { id: 'fabric', label: 'Fabric', desc: 'Lightweight modern modded engine (Java mods only)' },
                    { id: 'vanilla', label: 'Vanilla Mojang', desc: 'Standard un-modded server' },
                  ].map((item) => {
                    const isSelected = software === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        disabled={isCreating || isDownloading}
                        onClick={() => {
                          const newSw = item.id as ServerSoftwareType;
                          setSoftware(newSw);
                          if (isModdedServerSoftware(newSw)) {
                            setEnableCrossplay(false);
                          }
                        }}
                        className={`p-3 rounded-xl text-left border transition ${
                          isSelected
                            ? 'bg-success text-white font-bold border-transparent shadow-sm'
                            : 'bg-surface-card border-border-default hover:border-border-hover'
                        }`}
                      >
                        <strong className={`block text-xs font-bold ${isSelected ? 'text-white' : 'text-content-primary'}`}>
                          {item.label}
                        </strong>
                        <span className={`text-[10px] leading-tight block mt-0.5 ${isSelected ? 'text-white/90' : 'text-content-secondary'}`}>
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-content-primary">Minecraft Version</label>
                  {version.startsWith('26') && (
                    <span className="text-[10px] text-content-primary font-mono">Requires Java 25 (auto-handled)</span>
                  )}
                </div>
                <select
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  disabled={loadingVersions}
                  className="w-full px-4 py-2.5 bg-surface-base border border-border-default rounded-xl text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
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
                <div className="flex justify-between text-xs font-semibold text-content-primary">
                  <span>Dedicated Server RAM:</span>
                  <span className="text-content-primary font-mono font-bold text-sm">{ramGb} GB</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={1}
                  value={ramGb}
                  onChange={(e) => setRamGb(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer h-2 bg-surface-base rounded-lg"
                />
                <div className="flex gap-2 pt-1">
                  {[2, 4, 6, 8, 12, 16].map((gb) => (
                    <button
                      key={gb}
                      type="button"
                      onClick={() => setRamGb(gb)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${
                        ramGb === gb ? 'bg-success text-white' : 'bg-surface-base text-content-secondary'
                      }`}
                    >
                      {gb}G
                    </button>
                  ))}
                </div>
              </div>

              {/* Aikar Flags Switch */}
              <div className="flex items-center justify-between p-3 bg-surface-base rounded-xl border border-border-subtle">
                <div>
                  <span className="text-xs font-bold text-content-primary block">Enable Aikar's Optimized G1GC Flags</span>
                  <span className="text-[10px] text-content-secondary">Eliminates GC lag spikes during gameplay</span>
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
                <label className="text-xs font-semibold text-content-primary flex items-center gap-1.5">
                  <JavaIcon className="w-4 h-4" />
                  <span>Java Runtime Environment</span>
                </label>
                <select
                  value={selectedJava}
                  onChange={(e) => setSelectedJava(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs font-mono text-content-primary focus:outline-none focus:border-border-default"
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
              {/* Amber Warning for Modded Servers */}
              {isModded && (
                <div className="p-4 rounded-xl bg-warning-bg border border-warning-fg/30 text-warning-fg space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning-fg shrink-0" />
                    <span className="text-xs font-bold">
                      Bedrock Cross-Play Incompatible with Java Mods
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-warning-fg/90">
                    Minecraft Bedrock Edition cannot interpret or synchronize Java edition mods, custom entities, or modded item mechanics. Because this server uses {software === 'fabric' ? 'Fabric' : software.toUpperCase()}, GeyserMC cross-play is disabled to prevent client crashes and protocol desynchronization. If you need Bedrock cross-play, please choose a plugin-based engine like PaperMC or PurpurMC.
                  </p>
                </div>
              )}

              <div
                className={`flex items-center justify-between p-4 rounded-xl border transition ${
                  isModded
                    ? 'bg-surface-card/40 border-border-subtle opacity-50 cursor-not-allowed'
                    : 'bg-surface-base border-border-default'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-content-primary block">
                        Enable GeyserMC + Floodgate
                      </span>
                      {isModded && (
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-warning-bg text-warning-fg border border-warning-fg/30">
                          Unavailable on Modded
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-content-secondary">
                      {isModded
                        ? 'Bedrock cross-play bridge cannot run alongside Java mods'
                        : 'Bedrock (mobile, console, Windows 10/11) players can join'}
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={isModded || isCreating}
                  checked={!isModded && enableCrossplay}
                  onChange={(e) => {
                    if (!isModded) setEnableCrossplay(e.target.checked);
                  }}
                  className={`w-4 h-4 accent-emerald-500 ${
                    isModded ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                  }`}
                />
              </div>

              {!isModded && enableCrossplay && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-content-primary">Bedrock Port (UDP)</label>
                    <input
                      type="number"
                      value={bedrockPort}
                      onChange={(e) => setBedrockPort(parseInt(e.target.value, 10) || 19132)}
                      className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs font-mono text-content-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-content-primary">Bedrock Auth Mode</label>
                    <select
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary"
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

              {/* Launcher Access & World Defaults */}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <span className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                  Launcher Access & World Defaults
                </span>

                <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-default">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-content-primary block">Cracked (Offline Mode) Support</span>
                      <span className="text-[10px] text-content-secondary">Allows non-premium accounts (TLauncher, SKLauncher, Prism) + auto SkinsRestorer</span>
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
                    <label className="text-xs font-semibold text-content-primary">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary"
                    >
                      <option value="peaceful">Peaceful</option>
                      <option value="easy">Easy</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-content-primary">Gamemode</label>
                    <select
                      value={gamemode}
                      onChange={(e) => setGamemode(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary"
                    >
                      <option value="survival">Survival</option>
                      <option value="creative">Creative</option>
                      <option value="adventure">Adventure</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-default">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-xs font-bold text-content-primary block">PvP (Player vs Player)</span>
                      <span className="text-[10px] text-content-secondary">Allow players to attack and damage each other</span>
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
                  <label className="text-xs font-semibold text-content-primary">Server MOTD</label>
                  <input
                    type="text"
                    value={motd}
                    onChange={(e) => setMotd(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-base border border-border-default rounded-lg text-xs text-content-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Network Sharing (3 Options) */}
          {currentStep === 'network' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-content-primary">Choose Server Networking & Sharing Mode</label>
                <p className="text-[11px] text-content-secondary">
                  Select how players will connect to this Minecraft server. You can change this anytime later.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Option 1: PlayIt.gg Tunnel */}
                <div
                  onClick={() => setNetworkMode('cloud_relay')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    networkMode === 'cloud_relay'
                      ? 'bg-success text-white font-bold border-transparent shadow-sm'
                      : 'bg-surface-card border-border-default hover:border-border-hover'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border-default flex items-center justify-center p-1.5 shadow-sm shrink-0">
                        <PlayItIcon className="w-9 h-9 rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className={`text-xs font-bold ${networkMode === 'cloud_relay' ? 'text-white' : 'text-content-primary'}`}>
                            PlayIt.gg Tunnel (Recommended)
                          </strong>
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                            networkMode === 'cloud_relay'
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-success text-white'
                          }`}>
                            Universal Internet Play
                          </span>
                        </div>
                        <p className={`text-xs ${networkMode === 'cloud_relay' ? 'text-white/90' : 'text-content-secondary'}`}>
                          Play online with friends worldwide. Bypasses CGNAT & strict firewalls with zero router port forwarding.
                        </p>
                      </div>
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
                      ? 'bg-surface-base border-warning-fg/20 opacity-60 cursor-not-allowed'
                      : networkMode === 'upnp'
                      ? 'bg-success text-white font-bold border-transparent shadow-sm cursor-pointer'
                      : 'bg-surface-card border-border-default hover:border-border-hover cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className={`text-xs font-bold ${networkMode === 'upnp' ? 'text-white' : 'text-content-primary'}`}>
                            Direct UPnP Port Forward
                          </strong>
                          {upnpStatus.isSupported ? (
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                              networkMode === 'upnp'
                                ? 'bg-white/20 text-white border border-white/30'
                                : 'bg-surface-base text-content-primary border border-border-default'
                            }`}>
                              Recommended
                            </span>
                          ) : !upnpStatus.isSupported ? (
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-warning-bg text-warning-fg border border-warning-fg/30">
                              Unsupported by Gateway
                            </span>
                          ) : null}
                        </div>
                        <p className={`text-xs ${networkMode === 'upnp' ? 'text-white/90' : 'text-content-secondary'}`}>
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
                      ? 'bg-success text-white font-bold border-transparent shadow-sm'
                      : 'bg-surface-card border-border-default hover:border-border-hover'
                  }`}
                >
                  <div className="flex items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <strong className={`text-xs font-bold ${networkMode === 'lan_only' ? 'text-white' : 'text-content-primary'}`}>
                            Only Local LAN
                          </strong>
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                            networkMode === 'lan_only'
                              ? 'bg-white/20 text-white border border-white/30'
                              : 'bg-surface-card text-content-primary border border-border-default'
                          }`}>
                            Offline / Same Wi-Fi
                          </span>
                        </div>
                        <p className={`text-xs ${networkMode === 'lan_only' ? 'text-white/90' : 'text-content-secondary'}`}>
                          Offline mode for friends connected to your same Wi-Fi or local network.
                        </p>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Pre-installed Plugins */}
          {currentStep === 'plugins' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-content-primary">Starter Plugins & Addons</h3>
                <p className="text-xs text-content-secondary">
                  {isModded
                    ? 'Fabric servers utilize mods instead of Spigot plugins.'
                    : 'Select essential plugins to auto-install during server setup.'}
                </p>
              </div>

              {isModded ? (
                <div className="p-4 rounded-xl bg-surface-card border border-border-default space-y-2">
                  <div className="flex items-center gap-2 text-content-primary font-bold text-xs">
                    <Info className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Plugins Not Applicable for Fabric</span>
                  </div>
                  <p className="text-xs text-content-secondary leading-relaxed">
                    Bukkit/Spigot plugins are not supported on Fabric servers. Once your server is created, you can install custom Fabric mods (.jar files) via the Mods manager or directly in the server directory.
                  </p>
                </div>
              ) : (
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
                          if (isCreating || isDownloading) return;
                          if (isChecked) setSelectedPlugins(selectedPlugins.filter(x => x !== item.id));
                          else setSelectedPlugins([...selectedPlugins, item.id]);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                          isChecked
                            ? 'bg-surface-hover border-border-default'
                            : 'bg-surface-card border-border-default hover:border-border-hover'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <strong className="block text-xs text-content-primary">{item.name}</strong>
                          <span className="text-[11px] text-content-secondary block">{item.desc}</span>
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
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-default bg-surface-base">
          <div>
            {currentStep !== 'basic' && (
              <button
                type="button"
                disabled={isCreating || isDownloading}
                onClick={() => {
                  const idx = steps.findIndex(s => s.id === currentStep);
                  if (idx > 0) setCurrentStep(steps[idx - 1].id as WizardStep);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-card hover:bg-surface-hover text-content-primary rounded-lg text-xs font-semibold border border-border-default transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep !== 'plugins' ? (
              <button
                type="button"
                disabled={isCreating || isDownloading || (currentStep === 'basic' && (isNameDuplicate || !name.trim()))}
                onClick={() => {
                  const idx = steps.findIndex(s => s.id === currentStep);
                  if (idx < steps.length - 1) setCurrentStep(steps[idx + 1].id as WizardStep);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-card hover:bg-surface-hover text-content-primary rounded-lg text-xs font-semibold border border-border-default transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next Step</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating || isDownloading || isNameDuplicate || !name.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-success hover:bg-success/80 text-white font-bold text-xs rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Setting Up Server...</span>
                  </>
                ) : (
                  <span>Create & Launch Server</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
