import React, { useState, useEffect } from 'react';
import { useServerState, useServerActions } from '../../context/ServerContext';
import { useDialog } from '../../context/DialogContext';
import { ServerProperties } from '../../types';
import { GlassCard } from '../common/GlassCard';
import {
  UploadCloud,
  DownloadCloud,
  FolderOpen,
  Archive,
  Check,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Users,
  Layers,
  Sparkles,
  Shield,
  FileArchive,
  X
} from 'lucide-react';

interface WorldInfoData {
  exists: boolean;
  levelName: string;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  playerCount: number;
  regionCount: number;
  hasNether: boolean;
  hasEnd: boolean;
  lastModified?: number;
}

interface InspectionData {
  valid: boolean;
  levelName?: string;
  playerCount: number;
  regionCount: number;
  hasNether: boolean;
  hasEnd: boolean;
  isZip: boolean;
  error?: string;
}

export const WorldSettingsTab: React.FC = () => {
  const { activeServer, status } = useServerState();
  const { updateServerConfig, refreshServers, sendCommand } = useServerActions();
  const { showAlert } = useDialog();

  const [properties, setProperties] = useState<ServerProperties>({
    'server-port': 25565,
    'online-mode': true,
    'motd': 'A CraftTogether Minecraft Server',
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

  // Gameplay Gamerules State
  const [keepInventory, setKeepInventory] = useState(activeServer?.keepInventory !== false);
  const [showCoordinates, setShowCoordinates] = useState(activeServer?.showCoordinates !== false);
  const [disableMobGriefing, setDisableMobGriefing] = useState(activeServer?.disableMobGriefing === true);
  const [disableFireSpread, setDisableFireSpread] = useState(activeServer?.disableFireSpread === true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // World info state
  const [worldInfo, setWorldInfo] = useState<WorldInfoData | null>(null);
  const [loadingWorldInfo, setLoadingWorldInfo] = useState(false);

  // Import Modal & States
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string | null>(null);
  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [backupCurrent, setBackupCurrent] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const isServerRunning = status !== 'STOPPED';

  const loadWorldInfo = async () => {
    if (!activeServer || !window.electronAPI?.getWorldInfo) return;
    setLoadingWorldInfo(true);
    try {
      const info = await window.electronAPI.getWorldInfo(activeServer.id);
      setWorldInfo(info);
    } catch (e) {
      console.error('Failed to load world info', e);
    } finally {
      setLoadingWorldInfo(false);
    }
  };

  useEffect(() => {
    const loadProps = async () => {
      if (!activeServer) return;
      setKeepInventory(activeServer.keepInventory !== false);
      setShowCoordinates(activeServer.showCoordinates !== false);
      setDisableMobGriefing(activeServer.disableMobGriefing === true);
      setDisableFireSpread(activeServer.disableFireSpread === true);

      if (window.electronAPI?.readProperties) {
        const props = await window.electronAPI.readProperties(activeServer.id);
        if (props) setProperties(props);
      }
      loadWorldInfo();
    };
    loadProps();
  }, [activeServer]);

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

  // Browse for world archive (.zip) or directory
  const handleBrowseSource = async (mode: 'file' | 'folder') => {
    if (!window.electronAPI?.browseWorldSource) return;
    try {
      const res = await window.electronAPI.browseWorldSource(mode);
      if (res && res.sourcePath) {
        setSelectedSourcePath(res.sourcePath);
        setInspection(res.inspection);
      }
    } catch (e) {
      console.error('Failed to browse world source', e);
    }
  };

  // Execute world import
  const handleConfirmImport = async () => {
    if (!activeServer || !selectedSourcePath) return;

    if (isServerRunning) {
      await showAlert('Server is Running', 'Please stop the server before importing a new world to prevent file lock corruption.', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      const result = await window.electronAPI.importWorld({
        serverId: activeServer.id,
        sourcePath: selectedSourcePath,
        backupCurrent
      });

      setShowImportModal(false);
      setSelectedSourcePath(null);
      setInspection(null);
      await loadWorldInfo();

      await showAlert(
        'World Imported Successfully!',
        `Restored world "${result.levelName}" with ${result.playerCount} player inventory profile(s) and ${result.regionCount} region chunk file(s).${result.backupCreated ? ` Backup saved to: ${result.backupCreated}` : ''}`,
        'success'
      );
    } catch (err: any) {
      await showAlert('Import Failed', `Could not import world: ${err.message || err}`, 'warning');
    } finally {
      setIsImporting(false);
    }
  };

  // 1-Click Export World Backup to Zip
  const handleExportWorld = async () => {
    if (!activeServer || !window.electronAPI?.exportWorld) return;
    try {
      const defaultFilename = `${activeServer.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_world_backup.zip`;
      const targetPath = await window.electronAPI.browseWorldExportTarget(defaultFilename);
      if (!targetPath) return;

      setIsExporting(true);
      const res = await window.electronAPI.exportWorld({
        serverId: activeServer.id,
        targetZipPath: targetPath
      });

      await showAlert(
        'World Export Complete',
        `Successfully exported world backup to:\n${res.targetZipPath} (${(res.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
        'success'
      );
    } catch (err: any) {
      await showAlert('Export Error', `Failed to export world: ${err.message || err}`, 'warning');
    } finally {
      setIsExporting(false);
    }
  };

  const isCracked = properties['online-mode'] === false;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-content-primary">World & Gameplay Settings</h1>
          <p className="text-xs text-content-secondary">
            Manage world terrain, upload player saves & inventories, gamerules, and simulation limits
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-success hover:bg-success/80 text-white rounded-lg font-bold text-xs transition cursor-pointer shrink-0 shadow-sm"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : saveSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Saved!</span>
            </>
          ) : (
            <span>Save Changes</span>
          )}
        </button>
      </div>

      {/* Hero Card: World Upload, Inventory Import & Backup System */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-5 bg-gradient-to-br from-surface-elevated/80 to-surface-base/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-content-primary flex items-center gap-2">
                  <span>World Storage & Inventory Manager</span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    level: {worldInfo?.levelName || 'world'}
                  </span>
                </h2>
                <p className="text-xs text-content-secondary">
                  Upload custom worlds or restore previous singleplayer & multiplayer saves with all player items
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold text-xs transition cursor-pointer shadow-sm"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload / Import World</span>
            </button>

            <button
              onClick={handleExportWorld}
              disabled={isExporting || !worldInfo?.exists}
              className="flex items-center gap-2 px-3.5 py-2 bg-surface-elevated hover:bg-surface-hover text-content-primary border border-border-default rounded-lg font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              title="Download world backup zip"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-content-muted border-t-content-primary rounded-full animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4 text-content-secondary" />
              )}
              <span>Export World (.zip)</span>
            </button>
          </div>
        </div>

        {/* World Statistics Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-surface-base rounded-xl border border-border-subtle flex flex-col justify-between">
            <span className="text-[11px] text-content-secondary font-medium">World Size on Disk</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-bold text-content-primary font-mono">
                {worldInfo?.totalSizeFormatted || '0 MB'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-surface-base rounded-xl border border-border-subtle flex flex-col justify-between">
            <span className="text-[11px] text-content-secondary font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved Player Inventories</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-bold text-content-primary font-mono">
                {worldInfo?.playerCount ?? 0}
              </span>
              <span className="text-[10px] text-content-muted">playerdata .dat</span>
            </div>
          </div>

          <div className="p-3 bg-surface-base rounded-xl border border-border-subtle flex flex-col justify-between">
            <span className="text-[11px] text-content-secondary font-medium flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Terrain Chunks</span>
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-bold text-content-primary font-mono">
                {worldInfo?.regionCount ?? 0}
              </span>
              <span className="text-[10px] text-content-muted">regions (.mca)</span>
            </div>
          </div>

          <div className="p-3 bg-surface-base rounded-xl border border-border-subtle flex flex-col justify-between">
            <span className="text-[11px] text-content-secondary font-medium">Dimensions Active</span>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Overworld
              </span>
              {worldInfo?.hasNether && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  Nether
                </span>
              )}
              {worldInfo?.hasEnd && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  The End
                </span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Featured: Cracked / Online Mode Switcher Card */}
      <GlassCard className="rounded-xl p-6 border-border-default space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-content-primary">Authentication Mode</h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border bg-warning-bg text-warning-fg border-warning-fg/20">
                {isCracked ? 'Cracked Allowed' : 'Premium Only'}
              </span>
            </div>
            <p className="text-xs text-content-secondary">
              Allow cracked Minecraft launchers or enforce official Mojang Microsoft authentication
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-elevated p-1 rounded-lg border border-border-default shrink-0">
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
          <h3 className="text-sm font-bold text-content-primary flex items-center justify-between border-b border-border-subtle pb-3">
            <span>Live Game Rules</span>
            {isServerRunning && (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync Enabled
              </span>
            )}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Keep Inventory */}
            <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-content-primary block">Keep Inventory</span>
                  <span className="text-[10px] text-content-secondary">Retain items, armor & XP upon dying</span>
                </div>
              </div>
              <button
                onClick={() => setKeepInventory(!keepInventory)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${keepInventory ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${keepInventory ? 'translate-x-[18px]' : 'translate-x-1'}`}
                />
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
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showCoordinates ? 'translate-x-[18px]' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* Disable Mob Griefing */}
            <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-content-primary block">Anti-Creeper / Mob Griefing</span>
                  <span className="text-[10px] text-content-secondary">Prevent Creeper/Enderman block destruction</span>
                </div>
              </div>
              <button
                onClick={() => setDisableMobGriefing(!disableMobGriefing)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${disableMobGriefing ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${disableMobGriefing ? 'translate-x-[18px]' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* Disable Fire Spread */}
            <div className="flex items-center justify-between p-3.5 bg-surface-base rounded-xl border border-border-subtle">
              <div className="flex items-center gap-2.5">
                <div>
                  <span className="text-xs font-semibold text-content-primary block">Disable Fire Spread</span>
                  <span className="text-[10px] text-content-secondary">Prevent fire from spreading and destroying wood</span>
                </div>
              </div>
              <button
                onClick={() => setDisableFireSpread(!disableFireSpread)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${disableFireSpread ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${disableFireSpread ? 'translate-x-[18px]' : 'translate-x-1'}`}
                />
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
              <option value="peaceful">Peaceful (No hostile mobs, auto-regen)</option>
              <option value="easy">Easy</option>
              <option value="normal">Normal (Default)</option>
              <option value="hard">Hard (Full monster damage)</option>
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
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${properties.pvp !== false ? 'translate-x-[18px]' : 'translate-x-1'}`}
              />
            </button>
          </div>

          {/* Allow Flight */}
          <div className="flex items-center justify-between p-3 bg-surface-base rounded-xl border border-border-subtle">
            <div>
              <span className="text-xs font-semibold text-content-primary block">Allow Flight</span>
              <span className="text-[11px] text-content-secondary">Prevent kicking players for flying with Elytra</span>
            </div>
            <button
              onClick={() =>
                setProperties({
                  ...properties,
                  'allow-flight': properties['allow-flight'] === false ? true : false
                })
              }
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${properties['allow-flight'] !== false ? 'bg-success' : 'bg-content-muted'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${properties['allow-flight'] !== false ? 'translate-x-[18px]' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </GlassCard>

        {/* World & Simulation Limits */}
        <GlassCard className="rounded-2xl p-6 border-border-default space-y-5">
          <h3 className="text-sm font-bold text-content-primary flex items-center gap-2 border-b border-border-subtle pb-3">
            <span>World & Simulation Limits</span>
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
            <div className="flex justify-between items-center text-xs font-semibold text-content-primary">
              <span>View Distance (Render Chunks):</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={4}
                  max={64}
                  value={properties['view-distance'] || 10}
                  onChange={(e) =>
                    setProperties({ ...properties, 'view-distance': Math.max(4, Math.min(64, parseInt(e.target.value, 10) || 10)) })
                  }
                  className="w-14 px-1.5 py-0.5 bg-surface-base border border-border-default rounded text-right font-mono text-xs text-content-primary focus:outline-none focus:border-emerald-500"
                />
                <span className="text-content-primary font-mono">Chunks</span>
              </div>
            </div>
            <input
              type="range"
              min={4}
              max={64}
              value={properties['view-distance'] || 10}
              onChange={(e) =>
                setProperties({ ...properties, 'view-distance': parseInt(e.target.value, 10) })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[10px] text-content-muted">Controls client terrain render distance (expanded limit up to 64 chunks).</span>
          </div>

          {/* Simulation Distance */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-content-primary">
              <span>Simulation Distance:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={3}
                  max={32}
                  value={properties['simulation-distance'] || 10}
                  onChange={(e) =>
                    setProperties({ ...properties, 'simulation-distance': Math.max(3, Math.min(32, parseInt(e.target.value, 10) || 10)) })
                  }
                  className="w-14 px-1.5 py-0.5 bg-surface-base border border-border-default rounded text-right font-mono text-xs text-content-primary focus:outline-none focus:border-emerald-500"
                />
                <span className="text-content-primary font-mono">Chunks</span>
              </div>
            </div>
            <input
              type="range"
              min={3}
              max={32}
              value={properties['simulation-distance'] || 10}
              onChange={(e) =>
                setProperties({ ...properties, 'simulation-distance': parseInt(e.target.value, 10) })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <span className="text-[10px] text-content-muted">Chunks where mob AI and redstone operate (expanded limit up to 32 chunks).</span>
          </div>

          {/* Whitelist Switch */}
          <div className="flex items-center justify-between p-3 bg-surface-base rounded-xl border border-border-subtle">
            <div>
              <span className="text-xs font-semibold text-content-primary block">Whitelist Enforced</span>
              <span className="text-[11px] text-content-secondary">Only permitted players can connect</span>
            </div>
            <button
              onClick={() =>
                setProperties({
                  ...properties,
                  'white-list': properties['white-list'] === true ? false : true
                })
              }
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${properties['white-list'] === true ? 'bg-success' : 'bg-content-muted'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${properties['white-list'] === true ? 'translate-x-[18px]' : 'translate-x-1'}`}
              />
            </button>
          </div>
        </GlassCard>
      </div>

      {/* MOTD (Message of the Day) */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
        <h3 className="text-sm font-bold text-content-primary">Server Description (MOTD)</h3>
        <input
          type="text"
          value={properties.motd || ''}
          onChange={(e) => setProperties({ ...properties, motd: e.target.value })}
          placeholder="A CraftTogether Minecraft Server"
          className="w-full px-4 py-3 bg-surface-base border border-border-default rounded-xl text-sm font-mono text-content-primary focus:outline-none focus:border-border-default"
        />
      </GlassCard>

      {/* World Upload / Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated w-full max-w-xl rounded-2xl border border-border-default shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-content-primary">Upload & Import Minecraft World</h3>
                  <p className="text-xs text-content-secondary">
                    Restore worlds, player inventories, and settings from a .zip archive or saves folder
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedSourcePath(null);
                  setInspection(null);
                }}
                className="p-1 text-content-muted hover:text-content-primary rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Server Online Warning */}
            {isServerRunning && (
              <div className="p-3.5 bg-warning-bg/40 border border-warning-fg/30 rounded-xl flex items-start gap-3 text-warning-fg">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold">Server is currently online!</p>
                  <p className="opacity-90">
                    You must stop the server before importing a new world to prevent Windows file locks and chunk corruption.
                  </p>
                </div>
              </div>
            )}

            {/* Source Selection Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-content-primary block">Select World Source</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleBrowseSource('file')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-border-default bg-surface-base hover:bg-surface-hover transition cursor-pointer text-center space-y-2 group"
                >
                  <FileArchive className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-xs font-bold text-content-primary block">World Archive (.zip)</span>
                    <span className="text-[10px] text-content-secondary">Downloaded from website or backup</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleBrowseSource('folder')}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-border-default bg-surface-base hover:bg-surface-hover transition cursor-pointer text-center space-y-2 group"
                >
                  <FolderOpen className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div>
                    <span className="text-xs font-bold text-content-primary block">World Folder</span>
                    <span className="text-[10px] text-content-secondary">From .minecraft/saves or server</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Inspection Preview */}
            {selectedSourcePath && (
              <div className="p-4 bg-surface-base rounded-xl border border-border-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-content-primary">Selected Path:</span>
                  <span className="text-[10px] font-mono text-content-secondary truncate max-w-xs" title={selectedSourcePath}>
                    {selectedSourcePath}
                  </span>
                </div>

                {inspection ? (
                  inspection.valid ? (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valid Minecraft world detected ({inspection.levelName || 'World'})</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="p-2 bg-surface-elevated rounded-lg border border-border-subtle">
                          <span className="text-[10px] text-content-secondary block">Player Inventories</span>
                          <span className="font-bold text-content-primary font-mono">{inspection.playerCount}</span>
                        </div>
                        <div className="p-2 bg-surface-elevated rounded-lg border border-border-subtle">
                          <span className="text-[10px] text-content-secondary block">Regions (.mca)</span>
                          <span className="font-bold text-content-primary font-mono">{inspection.regionCount}</span>
                        </div>
                        <div className="p-2 bg-surface-elevated rounded-lg border border-border-subtle">
                          <span className="text-[10px] text-content-secondary block">Dimensions</span>
                          <span className="font-bold text-content-primary font-mono">
                            {inspection.hasNether ? 'Nether' : ''} {inspection.hasEnd ? '+ End' : ''} {!inspection.hasNether && !inspection.hasEnd ? 'Overworld' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-danger flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{inspection.error || 'Invalid world structure'}</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 text-xs text-content-secondary">
                    <div className="w-3.5 h-3.5 border-2 border-content-muted border-t-content-primary rounded-full animate-spin" />
                    <span>Analyzing world structure...</span>
                  </div>
                )}
              </div>
            )}

            {/* Safety: Backup Current World Checkbox */}
            <div className="flex items-center justify-between p-3 bg-surface-base rounded-xl border border-border-subtle">
              <div>
                <span className="text-xs font-semibold text-content-primary block">Create Safety Backup</span>
                <span className="text-[10px] text-content-secondary">
                  Automatically archives your current world before replacing it
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBackupCurrent(!backupCurrent)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${backupCurrent ? 'bg-success' : 'bg-content-muted'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${backupCurrent ? 'translate-x-[18px]' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setSelectedSourcePath(null);
                  setInspection(null);
                }}
                disabled={isImporting}
                className="px-4 py-2 bg-neutral-bg hover:bg-surface-hover text-content-primary text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || !selectedSourcePath || (inspection && !inspection.valid) || isServerRunning}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Extracting & Restoring...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Import World</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
