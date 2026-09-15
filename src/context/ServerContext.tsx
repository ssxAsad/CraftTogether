import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ServerStatus, ServerMetrics, PlayerInfo, ServerInstanceConfig, JavaRuntime } from '../types';

interface ServerState {
  servers: ServerInstanceConfig[];
  activeServer: ServerInstanceConfig | null;
  isLoadingServers: boolean;
  status: ServerStatus;
  metrics: ServerMetrics;
  players: PlayerInfo[];
  logs: Array<{ line: string; type: 'stdout' | 'stderr' | 'system' }>;
  javaRuntimes: JavaRuntime[];
  isDownloading: boolean;
  downloadProgress: { percent: number; software: string; version: string } | null;
  
}

interface ServerActions {
  startServer: () => Promise<boolean>;
  stopServer: () => Promise<boolean>;
  killServer: () => Promise<boolean>;
  sendCommand: (cmd: string) => Promise<boolean>;
  createServer: (config: Omit<ServerInstanceConfig, 'id' | 'serverDir'>) => Promise<void>;
  updateServerConfig: (serverId: string, partial: Partial<ServerInstanceConfig>) => Promise<void>;
  deleteServer: (serverId: string) => Promise<boolean>;
  selectServer: (server: ServerInstanceConfig) => void;
  clearLogs: () => void;
  refreshServers: () => Promise<void>;
  loadJavaRuntimes: () => Promise<void>;
}

const ServerStateContext = createContext<ServerState | undefined>(undefined);
const ServerActionsContext = createContext<ServerActions | undefined>(undefined);

declare global {
  interface Window {
    electronAPI?: any;
  }
}

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [servers, setServers] = useState<ServerInstanceConfig[]>([]);
  const [activeServer, setActiveServer] = useState<ServerInstanceConfig | null>(null);
  const [isLoadingServers, setIsLoadingServers] = useState<boolean>(true);
  const [status, setStatus] = useState<ServerStatus>('STOPPED');
  const [metrics, setMetrics] = useState<ServerMetrics>({
    cpu: 0,
    memoryMb: 0,
    tps: 20.0,
    onlinePlayers: 0,
    maxPlayers: 20,
    uptimeSeconds: 0
  });
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [logs, setLogs] = useState<Array<{ line: string; type: 'stdout' | 'stderr' | 'system' }>>([]);
  const [javaRuntimes, setJavaRuntimes] = useState<JavaRuntime[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; software: string; version: string } | null>(null);

  // Initialize servers instantly & Java detection in parallel
  const refreshServers = useCallback(async () => {
    if (window.electronAPI) {
      try {

        // 2. Fetch server instances from local storage directory immediately (<2ms)
        const list = await window.electronAPI.listServers();
        if (list && list.length > 0) {
          const savedActiveId = localStorage.getItem('craftora_active_server_id');
          const mapped: ServerInstanceConfig[] = list.map((s: any) => ({
            id: s.id,
            name: s.name || s.id,
            serverDir: s.path,
            javaPath: s.javaPath || 'java',
            allocatedRamGb: s.allocatedRamGb || 4,
            serverSoftware: s.serverSoftware || 'paper',
            version: s.version || '1.21.4',
            useAikarFlags: s.useAikarFlags !== false,
            port: s.port || 25565,
            isCracked: s.isCracked || false,
            networkMode: s.networkMode === 'lan_only' ? 'lan_only' : s.networkMode === 'upnp' ? 'upnp' : 'cloud_relay',
            keepInventory: s.keepInventory,
            showCoordinates: s.showCoordinates,
            onePlayerSleep: s.onePlayerSleep,
            disableMobGriefing: s.disableMobGriefing,
            disableFireSpread: s.disableFireSpread
          }));

          setServers(mapped);
          setActiveServer((prev) => {
            if (prev) {
              const stillExists = mapped.find(m => m.id === prev.id);
              if (stillExists) return stillExists;
            }
            if (savedActiveId) {
              const saved = mapped.find(m => m.id === savedActiveId);
              if (saved) return saved;
            }
            return mapped[0];
          });
        } else {
          setServers([]);
          setActiveServer(null);
        }
      } catch (err) {
        console.error('Error loading servers', err);
      } finally {
        setIsLoadingServers(false);
      }
    } else {
      // Browser preview without Electron
      const mockJavas: JavaRuntime[] = [
        { path: 'java.exe', version: '21.0.9', majorVersion: 21, isDefault: true, vendor: 'Eclipse Temurin' }
      ];
      setJavaRuntimes(mockJavas);
      const savedMock = localStorage.getItem('craftora_mock_servers');
      if (savedMock) {
        try {
          const parsed = JSON.parse(savedMock);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setServers(parsed);
            setActiveServer((prev) => prev ? (parsed.find(p => p.id === prev.id) || parsed[0]) : parsed[0]);
            setIsLoadingServers(false);
            return;
          }
        } catch (e) {}
      }
      setServers([]);
      setActiveServer(null);
      setIsLoadingServers(false);
    }
  }, []);

  const loadJavaRuntimes = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const javas = await window.electronAPI.detectJava();
        if (Array.isArray(javas) && javas.length > 0) {
          setJavaRuntimes(javas);
        }
      } catch (err: any) {
        console.warn('On-demand Java detection warning:', err);
      }
    }
  }, []);

  useEffect(() => {
    refreshServers();

    if (window.electronAPI) {
      const unsubLog = window.electronAPI.onServerLog((logData: any) => {
        if (Array.isArray(logData)) {
          setLogs((prev) => [...prev.slice(Math.max(0, prev.length - (800 - logData.length))), ...logData]);
        } else if (logData) {
          setLogs((prev) => [...prev.slice(-799), logData]);
        }
      });

      const unsubStatus = window.electronAPI.onServerStatusChanged((newStatus: ServerStatus) => {
        setStatus(newStatus);
      });

      const unsubMetrics = window.electronAPI.onServerMetricsUpdated((newMetrics: ServerMetrics) => {
        setMetrics(newMetrics);
      });

      const unsubPlayers = window.electronAPI.onServerPlayersUpdated((newPlayers: PlayerInfo[]) => {
        setPlayers(newPlayers);
      });

      const unsubDownload = window.electronAPI.onDownloadProgress((prog: any) => {
        setIsDownloading(prog.percent < 100);
        setDownloadProgress(prog);
      });

      return () => {
        unsubLog();
        unsubStatus();
        unsubMetrics();
        unsubPlayers();
        unsubDownload();
      };
    }
  }, [refreshServers]);

  const startServer = useCallback(async (): Promise<boolean> => {
    if (!activeServer) return false;
    if (window.electronAPI) {
      return await window.electronAPI.startServer(activeServer);
    } else {
      setStatus('STARTING');
      setTimeout(() => {
        setStatus('ONLINE');
        setLogs(prev => [...prev, { line: '[Craftora Mock] Server is ONLINE and accepting connections! ✨', type: 'system' }]);
      }, 1500);
      return true;
    }
  }, [activeServer]);

  const stopServer = useCallback(async (): Promise<boolean> => {
    if (window.electronAPI) {
      return await window.electronAPI.stopServer();
    } else {
      setStatus('STOPPING');
      setTimeout(() => setStatus('STOPPED'), 1000);
      return true;
    }
  }, []);

  const killServer = useCallback(async (): Promise<boolean> => {
    if (window.electronAPI) {
      return await window.electronAPI.killServer();
    } else {
      setStatus('STOPPED');
      return true;
    }
  }, []);

  const sendCommand = useCallback(async (cmd: string): Promise<boolean> => {
    if (window.electronAPI) {
      return await window.electronAPI.sendCommand(cmd);
    } else {
      setLogs(prev => [...prev, { line: `> ${cmd}`, type: 'system' }]);
      return true;
    }
  }, []);

  const createServer = useCallback(async (config: Omit<ServerInstanceConfig, 'id' | 'serverDir'>): Promise<void> => {
    const cleanId = config.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    setIsDownloading(true);

    if (window.electronAPI) {
      try {
        await window.electronAPI.downloadJar({
          software: config.serverSoftware,
          version: config.version,
          serverId: cleanId
        });

        // Set properties (cracked mode, port)
        await window.electronAPI.writeProperties({
          serverId: cleanId,
          properties: {
            'server-port': config.port,
            'online-mode': !config.isCracked,
            'motd': `Craftora ${config.name}`
          }
        });

        // Save server metadata (networkMode, RAM, software, version, etc.)
        await window.electronAPI.saveServerConfig({
          serverId: cleanId,
          config: {
            name: config.name,
            serverSoftware: config.serverSoftware,
            version: config.version,
            allocatedRamGb: config.allocatedRamGb,
            javaPath: config.javaPath,
            useAikarFlags: config.useAikarFlags,
            port: config.port,
            isCracked: config.isCracked,
            networkMode: config.networkMode,
            keepInventory: config.keepInventory !== undefined ? config.keepInventory : true,
            showCoordinates: config.showCoordinates !== undefined ? config.showCoordinates : true,
            onePlayerSleep: config.onePlayerSleep !== undefined ? config.onePlayerSleep : true,
            disableMobGriefing: config.disableMobGriefing !== undefined ? config.disableMobGriefing : false,
            disableFireSpread: config.disableFireSpread !== undefined ? config.disableFireSpread : false
          }
        });

        await refreshServers();
        localStorage.setItem('craftora_active_server_id', cleanId);
        setIsDownloading(false);
      } catch (err) {
        console.error('Error creating server', err);
        setIsDownloading(false);
        throw err;
      }
    } else {
      // Mock creation
      setTimeout(() => {
        const newServer: ServerInstanceConfig = {
          ...config,
          id: cleanId,
          serverDir: `C:/Craftora/servers/${cleanId}`,
          keepInventory: config.keepInventory !== undefined ? config.keepInventory : true,
          showCoordinates: config.showCoordinates !== undefined ? config.showCoordinates : true,
          onePlayerSleep: config.onePlayerSleep !== undefined ? config.onePlayerSleep : true,
          disableMobGriefing: config.disableMobGriefing !== undefined ? config.disableMobGriefing : false,
          disableFireSpread: config.disableFireSpread !== undefined ? config.disableFireSpread : false
        };
        setServers(prev => {
          const updated = [...prev, newServer];
          localStorage.setItem('craftora_mock_servers', JSON.stringify(updated));
          return updated;
        });
        setActiveServer(newServer);
        localStorage.setItem('craftora_active_server_id', cleanId);
        setIsDownloading(false);
      }, 1500);
    }
  }, [refreshServers]);

  const updateServerConfig = useCallback(async (serverId: string, partial: Partial<ServerInstanceConfig>): Promise<void> => {
    if (window.electronAPI) {
      await window.electronAPI.saveServerConfig({
        serverId,
        config: partial
      });
    }

    setServers(prev => {
      const updated = prev.map(s => s.id === serverId ? { ...s, ...partial } : s);
      if (!window.electronAPI) {
        localStorage.setItem('craftora_mock_servers', JSON.stringify(updated));
      }
      return updated;
    });

    setActiveServer(prev => prev && prev.id === serverId ? { ...prev, ...partial } : prev);
  }, []);

  const deleteServer = useCallback(async (serverId: string): Promise<boolean> => {
    if (status !== 'STOPPED' && activeServer?.id === serverId) {
      await stopServer();
    }
    if (window.electronAPI) {
      await window.electronAPI.deleteServer(serverId);
    }
    const remaining = servers.filter(s => s.id !== serverId);
    setServers(remaining);
    if (!window.electronAPI) {
      localStorage.setItem('craftora_mock_servers', JSON.stringify(remaining));
    }
    if (activeServer?.id === serverId) {
      const nextActive = remaining.length > 0 ? remaining[0] : null;
      setActiveServer(nextActive);
      if (nextActive) {
        localStorage.setItem('craftora_active_server_id', nextActive.id);
      } else {
        localStorage.removeItem('craftora_active_server_id');
      }
    }
    await refreshServers();
    return true;
  }, [status, activeServer, servers, refreshServers]);

  const selectServer = useCallback((server: ServerInstanceConfig) => {
    if (status !== 'STOPPED' && activeServer?.id !== server.id) return;
    setActiveServer(server);
    localStorage.setItem('craftora_active_server_id', server.id);
    setLogs([]);
  }, [status, activeServer]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);


  const actions = React.useMemo<ServerActions>(() => ({
    startServer, stopServer, killServer, sendCommand, createServer, 
    updateServerConfig, deleteServer, selectServer, clearLogs, refreshServers,
    loadJavaRuntimes
  }), [activeServer, status, servers, isDownloading, refreshServers, loadJavaRuntimes]);

  const state = React.useMemo<ServerState>(() => ({
    servers, activeServer, isLoadingServers, status, metrics, players, 
    logs, javaRuntimes, isDownloading, downloadProgress
  }), [servers, activeServer, isLoadingServers, status, metrics, players, logs, javaRuntimes, isDownloading, downloadProgress]);

  return (
    <ServerActionsContext.Provider value={actions}>
      <ServerStateContext.Provider value={state}>
        {children}
      </ServerStateContext.Provider>
    </ServerActionsContext.Provider>
  );
};


export const useServerState = () => {
  const context = useContext(ServerStateContext);
  if (!context) throw new Error('useServerState must be used within a ServerProvider');
  return context;
};

export const useServerActions = () => {
  const context = useContext(ServerActionsContext);
  if (!context) throw new Error('useServerActions must be used within a ServerProvider');
  return context;
};
