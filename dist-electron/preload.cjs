"use strict";
const electron = require("electron");
const electronAPI = {
  // First launch setup
  getSetupStatus: () => electron.ipcRenderer.invoke("app:get-setup-status"),
  validateDirectory: (targetPath) => electron.ipcRenderer.invoke("app:validate-directory", targetPath),
  setStorageDirectory: (targetPath) => electron.ipcRenderer.invoke("app:set-storage-directory", targetPath),
  browseDirectory: () => electron.ipcRenderer.invoke("dialog:browse-directory"),
  checkSetupDependencies: () => electron.ipcRenderer.invoke("setup:check-dependencies"),
  installSetupDependency: (id) => electron.ipcRenderer.invoke("setup:install-dependency", id),
  onSetupDependencyProgress: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on("setup:dependency-progress", handler);
    return () => electron.ipcRenderer.removeListener("setup:dependency-progress", handler);
  },
  // Server process
  startServer: (config) => electron.ipcRenderer.invoke("server:start", config),
  stopServer: () => electron.ipcRenderer.invoke("server:stop"),
  killServer: () => electron.ipcRenderer.invoke("server:kill"),
  sendCommand: (cmd) => electron.ipcRenderer.invoke("server:send-command", cmd),
  getServerStatus: () => electron.ipcRenderer.invoke("server:get-status"),
  getServerMetrics: () => electron.ipcRenderer.invoke("server:get-metrics"),
  getServerPlayers: () => electron.ipcRenderer.invoke("server:get-players"),
  // Subscriptions
  onServerLog: (callback) => {
    const handler = (_, data) => callback(data);
    electron.ipcRenderer.on("server:log", handler);
    return () => electron.ipcRenderer.removeListener("server:log", handler);
  },
  onServerStatusChanged: (callback) => {
    const handler = (_, status) => callback(status);
    electron.ipcRenderer.on("server:status-changed", handler);
    return () => electron.ipcRenderer.removeListener("server:status-changed", handler);
  },
  onServerMetricsUpdated: (callback) => {
    const handler = (_, metrics) => callback(metrics);
    electron.ipcRenderer.on("server:metrics-updated", handler);
    return () => electron.ipcRenderer.removeListener("server:metrics-updated", handler);
  },
  onServerPlayersUpdated: (callback) => {
    const handler = (_, players) => callback(players);
    electron.ipcRenderer.on("server:players-updated", handler);
    return () => electron.ipcRenderer.removeListener("server:players-updated", handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_, progress) => callback(progress);
    electron.ipcRenderer.on("jars:download-progress", handler);
    return () => electron.ipcRenderer.removeListener("jars:download-progress", handler);
  },
  // Java & Jars
  detectJava: () => electron.ipcRenderer.invoke("java:detect-all"),
  installJava21: () => electron.ipcRenderer.invoke("java:install-21"),
  onJavaInstallProgress: (callback) => {
    const handler = (_, percent) => callback(percent);
    electron.ipcRenderer.on("java:install-progress", handler);
    return () => electron.ipcRenderer.removeListener("java:install-progress", handler);
  },
  getSoftwareVersions: (software) => electron.ipcRenderer.invoke("jars:get-versions", software),
  downloadJar: (params) => electron.ipcRenderer.invoke("jars:download-jar", params),
  // UPnP Direct Port Forwarding
  checkUpnpSupport: (forceRefresh) => electron.ipcRenderer.invoke("upnp:check-support", forceRefresh),
  startUpnp: (params) => electron.ipcRenderer.invoke("upnp:start", params || {}),
  stopUpnp: (params) => electron.ipcRenderer.invoke("upnp:stop", params || {}),
  getUpnpStatus: () => electron.ipcRenderer.invoke("upnp:get-status"),
  // Cloud Relay (Playit Zero-Auth Engine)
  startCloudTunnel: (params) => electron.ipcRenderer.invoke("cloud-tunnel:start", params || {}),
  stopCloudTunnel: () => electron.ipcRenderer.invoke("cloud-tunnel:stop"),
  getCloudTunnelStatus: () => electron.ipcRenderer.invoke("cloud-tunnel:get-status"),
  ensureCloudTunnelBinary: () => electron.ipcRenderer.invoke("cloud-tunnel:ensure-binary"),
  onCloudTunnelStatus: (callback) => {
    const handler = (_, status) => callback(status);
    electron.ipcRenderer.on("cloud-tunnel:status-update", handler);
    return () => {
      electron.ipcRenderer.removeListener("cloud-tunnel:status-update", handler);
    };
  },
  // LAN Discovery
  startLanBroadcast: (params) => electron.ipcRenderer.invoke("lan:start", params),
  stopLanBroadcast: () => electron.ipcRenderer.invoke("lan:stop"),
  getLanStatus: () => electron.ipcRenderer.invoke("lan:get-status"),
  // Network diagnostics
  getNetworkDiagnostics: () => electron.ipcRenderer.invoke("network:get-diagnostics"),
  checkPort: (port) => electron.ipcRenderer.invoke("network:check-port", port),
  // Cross-play (GeyserMC)
  isGeyserInstalled: (serverId) => electron.ipcRenderer.invoke("geyser:is-installed", serverId),
  installGeyser: (serverId) => electron.ipcRenderer.invoke("geyser:install", serverId),
  removeGeyser: (serverId) => electron.ipcRenderer.invoke("geyser:remove", serverId),
  getGeyserConfig: (serverId) => electron.ipcRenderer.invoke("geyser:get-config", serverId),
  saveGeyserConfig: (params) => electron.ipcRenderer.invoke("geyser:save-config", params),
  // Plugins
  getPluginCatalog: () => electron.ipcRenderer.invoke("plugins:get-catalog"),
  getInstalledPlugins: (serverId) => electron.ipcRenderer.invoke("plugins:get-installed", serverId),
  installPlugin: (params) => electron.ipcRenderer.invoke("plugins:install", params),
  installSpigetPlugin: (params) => electron.ipcRenderer.invoke("plugins:install-spiget", params),
  togglePlugin: (params) => electron.ipcRenderer.invoke("plugins:toggle", params),
  deletePlugin: (params) => electron.ipcRenderer.invoke("plugins:delete", params),
  ensureSkinsRestorer: (serverId) => electron.ipcRenderer.invoke("plugins:ensure-skins-restorer", serverId),
  // Mods
  getInstalledMods: (serverId) => electron.ipcRenderer.invoke("mods:get-installed", serverId),
  uploadModPackage: (params) => electron.ipcRenderer.invoke("mods:upload-package", params),
  toggleMod: (params) => electron.ipcRenderer.invoke("mods:toggle", params),
  deleteMod: (params) => electron.ipcRenderer.invoke("mods:delete", params),
  // Config & Properties
  readProperties: (serverId) => electron.ipcRenderer.invoke("config:read-properties", serverId),
  writeProperties: (params) => electron.ipcRenderer.invoke("config:write-properties", params),
  setCrackedMode: (params) => electron.ipcRenderer.invoke("config:set-cracked", params),
  listServers: () => electron.ipcRenderer.invoke("servers:list"),
  saveServerConfig: (params) => electron.ipcRenderer.invoke("servers:save-config", params),
  deleteServer: (serverId) => electron.ipcRenderer.invoke("servers:delete", serverId),
  getServersDir: () => electron.ipcRenderer.invoke("paths:get-servers-dir"),
  // System & Shell
  openExternal: (url) => electron.ipcRenderer.invoke("system:open-external", url),
  // Window frame controls
  minimizeWindow: () => electron.ipcRenderer.send("window:minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window:maximize"),
  closeWindow: () => electron.ipcRenderer.send("window:close")
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
