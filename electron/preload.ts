import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  // First Launch & Workspace setup
  getSetupStatus: () => Promise<{ isSetupComplete: boolean; storageDirectory: string }>;
  validateDirectory: (targetPath: string) => Promise<{ isValid: boolean; isEmpty: boolean; error?: string; path: string }>;
  setStorageDirectory: (targetPath: string) => Promise<boolean>;
  browseDirectory: () => Promise<{ path: string; validation: { isValid: boolean; isEmpty: boolean; error?: string } } | null>;
  checkSetupDependencies: () => Promise<any[]>;
  installSetupDependency: (id: 'java' | 'cloud_relay' | 'papermc' | 'plugins') => Promise<boolean>;
  onSetupDependencyProgress: (callback: (data: { id: string; percent: number; message?: string }) => void) => () => void;

  // Server process
  startServer: (config: any) => Promise<boolean>;
  stopServer: () => Promise<boolean>;
  killServer: () => Promise<boolean>;
  sendCommand: (cmd: string) => Promise<boolean>;
  getServerStatus: () => Promise<string>;
  getServerMetrics: () => Promise<any>;
  getServerPlayers: () => Promise<any[]>;

  // Subscriptions
  onServerLog: (callback: (data: { line: string; type: 'stdout' | 'stderr' | 'system' }) => void) => () => void;
  onServerStatusChanged: (callback: (status: string) => void) => () => void;
  onServerMetricsUpdated: (callback: (metrics: any) => void) => () => void;
  onServerPlayersUpdated: (callback: (players: any[]) => void) => () => void;
  onDownloadProgress: (callback: (progress: any) => void) => () => void;

  // Java & Jars
  detectJava: () => Promise<any[]>;
  installJava21: () => Promise<boolean>;
  onJavaInstallProgress: (callback: (percent: number) => void) => () => void;
  getSoftwareVersions: (software: string) => Promise<string[]>;
  downloadJar: (params: { software: string; version: string; serverId: string }) => Promise<string>;

  // UPnP Direct Port Forwarding
  checkUpnpSupport: (forceRefresh?: boolean) => Promise<any>;
  startUpnp: (params?: { port?: number; protocol?: 'TCP' | 'UDP'; description?: string }) => Promise<any>;
  stopUpnp: (params?: { port?: number; protocol?: 'TCP' | 'UDP' }) => Promise<any>;
  getUpnpStatus: () => Promise<any>;

  // Cloud Relay (Playit Zero-Auth Engine)
  startCloudTunnel: (params?: { port?: number }) => Promise<any>;
  stopCloudTunnel: () => Promise<any>;
  getCloudTunnelStatus: () => Promise<any>;
  ensureCloudTunnelBinary: () => Promise<boolean>;
  onCloudTunnelStatus: (callback: (status: any) => void) => () => void;

  // LAN Discovery
  startLanBroadcast: (params: { motd: string; port: number }) => Promise<boolean>;
  stopLanBroadcast: () => Promise<boolean>;
  getLanStatus: () => Promise<boolean>;

  // Network diagnostics
  getNetworkDiagnostics: () => Promise<any>;
  checkPort: (port: number) => Promise<boolean>;

  // Cross-play (GeyserMC)
  isGeyserInstalled: (serverId: string) => Promise<boolean>;
  installGeyser: (serverId: string) => Promise<boolean>;
  removeGeyser: (serverId: string) => Promise<boolean>;
  getGeyserConfig: (serverId: string) => Promise<any>;
  saveGeyserConfig: (params: { serverId: string; config: any }) => Promise<boolean>;

  // Plugins
  getPluginCatalog: () => Promise<any[]>;
  getInstalledPlugins: (serverId: string) => Promise<any[]>;
  installPlugin: (params: { serverId: string; pluginId: string }) => Promise<string>;
  togglePlugin: (params: { serverId: string; filename: string }) => Promise<boolean>;
  deletePlugin: (params: { serverId: string; filename: string }) => Promise<boolean>;
  ensureSkinsRestorer: (serverId: string) => Promise<boolean>;

  // Config & Properties
  readProperties: (serverId: string) => Promise<any>;
  writeProperties: (params: { serverId: string; properties: any }) => Promise<boolean>;
  setCrackedMode: (params: { serverId: string; isCracked: boolean }) => Promise<boolean>;
  listServers: () => Promise<any[]>;
  saveServerConfig: (params: { serverId: string; config: any }) => Promise<boolean>;
  deleteServer: (serverId: string) => Promise<boolean>;
  getServersDir: () => Promise<string>;

  // System & Shell
  openExternal: (url: string) => Promise<boolean>;

  // Window frame controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

const electronAPI: IElectronAPI = {
  // First launch setup
  getSetupStatus: () => ipcRenderer.invoke('app:get-setup-status'),
  validateDirectory: (targetPath) => ipcRenderer.invoke('app:validate-directory', targetPath),
  setStorageDirectory: (targetPath) => ipcRenderer.invoke('app:set-storage-directory', targetPath),
  browseDirectory: () => ipcRenderer.invoke('dialog:browse-directory'),
  checkSetupDependencies: () => ipcRenderer.invoke('setup:check-dependencies'),
  installSetupDependency: (id) => ipcRenderer.invoke('setup:install-dependency', id),
  onSetupDependencyProgress: (callback) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('setup:dependency-progress', handler);
    return () => ipcRenderer.removeListener('setup:dependency-progress', handler);
  },

  // Server process
  startServer: (config) => ipcRenderer.invoke('server:start', config),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  killServer: () => ipcRenderer.invoke('server:kill'),
  sendCommand: (cmd) => ipcRenderer.invoke('server:send-command', cmd),
  getServerStatus: () => ipcRenderer.invoke('server:get-status'),
  getServerMetrics: () => ipcRenderer.invoke('server:get-metrics'),
  getServerPlayers: () => ipcRenderer.invoke('server:get-players'),

  // Subscriptions
  onServerLog: (callback) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on('server:log', handler);
    return () => ipcRenderer.removeListener('server:log', handler);
  },
  onServerStatusChanged: (callback) => {
    const handler = (_: any, status: string) => callback(status);
    ipcRenderer.on('server:status-changed', handler);
    return () => ipcRenderer.removeListener('server:status-changed', handler);
  },
  onServerMetricsUpdated: (callback) => {
    const handler = (_: any, metrics: any) => callback(metrics);
    ipcRenderer.on('server:metrics-updated', handler);
    return () => ipcRenderer.removeListener('server:metrics-updated', handler);
  },
  onServerPlayersUpdated: (callback) => {
    const handler = (_: any, players: any[]) => callback(players);
    ipcRenderer.on('server:players-updated', handler);
    return () => ipcRenderer.removeListener('server:players-updated', handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('jars:download-progress', handler);
    return () => ipcRenderer.removeListener('jars:download-progress', handler);
  },

  // Java & Jars
  detectJava: () => ipcRenderer.invoke('java:detect-all'),
  installJava21: () => ipcRenderer.invoke('java:install-21'),
  onJavaInstallProgress: (callback) => {
    const handler = (_: any, percent: number) => callback(percent);
    ipcRenderer.on('java:install-progress', handler);
    return () => ipcRenderer.removeListener('java:install-progress', handler);
  },
  getSoftwareVersions: (software) => ipcRenderer.invoke('jars:get-versions', software),
  downloadJar: (params) => ipcRenderer.invoke('jars:download-jar', params),

  // UPnP Direct Port Forwarding
  checkUpnpSupport: (forceRefresh) => ipcRenderer.invoke('upnp:check-support', forceRefresh),
  startUpnp: (params) => ipcRenderer.invoke('upnp:start', params || {}),
  stopUpnp: (params) => ipcRenderer.invoke('upnp:stop', params || {}),
  getUpnpStatus: () => ipcRenderer.invoke('upnp:get-status'),

  // Cloud Relay (Playit Zero-Auth Engine)
  startCloudTunnel: (params) => ipcRenderer.invoke('cloud-tunnel:start', params || {}),
  stopCloudTunnel: () => ipcRenderer.invoke('cloud-tunnel:stop'),
  getCloudTunnelStatus: () => ipcRenderer.invoke('cloud-tunnel:get-status'),
  ensureCloudTunnelBinary: () => ipcRenderer.invoke('cloud-tunnel:ensure-binary'),
  onCloudTunnelStatus: (callback) => {
    const handler = (_: any, status: any) => callback(status);
    ipcRenderer.on('cloud-tunnel:status-update', handler);
    return () => {
      ipcRenderer.removeListener('cloud-tunnel:status-update', handler);
    };
  },

  // LAN Discovery
  startLanBroadcast: (params) => ipcRenderer.invoke('lan:start', params),
  stopLanBroadcast: () => ipcRenderer.invoke('lan:stop'),
  getLanStatus: () => ipcRenderer.invoke('lan:get-status'),

  // Network diagnostics
  getNetworkDiagnostics: () => ipcRenderer.invoke('network:get-diagnostics'),
  checkPort: (port) => ipcRenderer.invoke('network:check-port', port),

  // Cross-play (GeyserMC)
  isGeyserInstalled: (serverId) => ipcRenderer.invoke('geyser:is-installed', serverId),
  installGeyser: (serverId) => ipcRenderer.invoke('geyser:install', serverId),
  removeGeyser: (serverId) => ipcRenderer.invoke('geyser:remove', serverId),
  getGeyserConfig: (serverId) => ipcRenderer.invoke('geyser:get-config', serverId),
  saveGeyserConfig: (params) => ipcRenderer.invoke('geyser:save-config', params),

  // Plugins
  getPluginCatalog: () => ipcRenderer.invoke('plugins:get-catalog'),
  getInstalledPlugins: (serverId) => ipcRenderer.invoke('plugins:get-installed', serverId),
  installPlugin: (params) => ipcRenderer.invoke('plugins:install', params),
  togglePlugin: (params) => ipcRenderer.invoke('plugins:toggle', params),
  deletePlugin: (params) => ipcRenderer.invoke('plugins:delete', params),
  ensureSkinsRestorer: (serverId) => ipcRenderer.invoke('plugins:ensure-skins-restorer', serverId),

  // Config & Properties
  readProperties: (serverId) => ipcRenderer.invoke('config:read-properties', serverId),
  writeProperties: (params) => ipcRenderer.invoke('config:write-properties', params),
  setCrackedMode: (params) => ipcRenderer.invoke('config:set-cracked', params),
  listServers: () => ipcRenderer.invoke('servers:list'),
  saveServerConfig: (params) => ipcRenderer.invoke('servers:save-config', params),
  deleteServer: (serverId) => ipcRenderer.invoke('servers:delete', serverId),
  getServersDir: () => ipcRenderer.invoke('paths:get-servers-dir'),

  // System & Shell
  openExternal: (url) => ipcRenderer.invoke('system:open-external', url),

  // Window frame controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
