const { contextBridge: s, ipcRenderer: r } = require("electron"), i = {
  // First launch setup
  getSetupStatus: () => r.invoke("app:get-setup-status"),
  validateDirectory: (e) => r.invoke("app:validate-directory", e),
  setStorageDirectory: (e) => r.invoke("app:set-storage-directory", e),
  browseDirectory: () => r.invoke("dialog:browse-directory"),
  // Server process
  startServer: (e) => r.invoke("server:start", e),
  stopServer: () => r.invoke("server:stop"),
  killServer: () => r.invoke("server:kill"),
  sendCommand: (e) => r.invoke("server:send-command", e),
  getServerStatus: () => r.invoke("server:get-status"),
  getServerMetrics: () => r.invoke("server:get-metrics"),
  getServerPlayers: () => r.invoke("server:get-players"),
  // Subscriptions
  onServerLog: (e) => {
    const n = (o, t) => e(t);
    return r.on("server:log", n), () => r.removeListener("server:log", n);
  },
  onServerStatusChanged: (e) => {
    const n = (o, t) => e(t);
    return r.on("server:status-changed", n), () => r.removeListener("server:status-changed", n);
  },
  onServerMetricsUpdated: (e) => {
    const n = (o, t) => e(t);
    return r.on("server:metrics-updated", n), () => r.removeListener("server:metrics-updated", n);
  },
  onServerPlayersUpdated: (e) => {
    const n = (o, t) => e(t);
    return r.on("server:players-updated", n), () => r.removeListener("server:players-updated", n);
  },
  onDownloadProgress: (e) => {
    const n = (o, t) => e(t);
    return r.on("jars:download-progress", n), () => r.removeListener("jars:download-progress", n);
  },
  // Java & Jars
  detectJava: () => r.invoke("java:detect-all"),
  getSoftwareVersions: (e) => r.invoke("jars:get-versions", e),
  downloadJar: (e) => r.invoke("jars:download-jar", e),
  // Free ngrok TCP
  startNgrok: (e) => r.invoke("ngrok:start", e),
  stopNgrok: () => r.invoke("ngrok:stop"),
  getNgrokStatus: () => r.invoke("ngrok:get-status"),
  saveNgrokToken: (e) => r.invoke("ngrok:save-token", e),
  getNgrokToken: () => r.invoke("ngrok:get-token"),
  // UPnP & LAN
  mapUpnp: (e) => r.invoke("upnp:map", e),
  unmapUpnp: (e) => r.invoke("upnp:unmap", e),
  getUpnpStatus: () => r.invoke("upnp:get-status"),
  startLanBroadcast: (e) => r.invoke("lan:start", e),
  stopLanBroadcast: () => r.invoke("lan:stop"),
  getLanStatus: () => r.invoke("lan:get-status"),
  // Network diagnostics
  getNetworkDiagnostics: () => r.invoke("network:get-diagnostics"),
  checkPort: (e) => r.invoke("network:check-port", e),
  // Cross-play (GeyserMC)
  isGeyserInstalled: (e) => r.invoke("geyser:is-installed", e),
  installGeyser: (e) => r.invoke("geyser:install", e),
  removeGeyser: (e) => r.invoke("geyser:remove", e),
  getGeyserConfig: (e) => r.invoke("geyser:get-config", e),
  saveGeyserConfig: (e) => r.invoke("geyser:save-config", e),
  // Plugins
  getPluginCatalog: () => r.invoke("plugins:get-catalog"),
  getInstalledPlugins: (e) => r.invoke("plugins:get-installed", e),
  installPlugin: (e) => r.invoke("plugins:install", e),
  togglePlugin: (e) => r.invoke("plugins:toggle", e),
  deletePlugin: (e) => r.invoke("plugins:delete", e),
  ensureSkinsRestorer: (e) => r.invoke("plugins:ensure-skins-restorer", e),
  // Config & Properties
  readProperties: (e) => r.invoke("config:read-properties", e),
  writeProperties: (e) => r.invoke("config:write-properties", e),
  setCrackedMode: (e) => r.invoke("config:set-cracked", e),
  listServers: () => r.invoke("servers:list"),
  getServersDir: () => r.invoke("paths:get-servers-dir"),
  // Window frame controls
  minimizeWindow: () => r.send("window:minimize"),
  maximizeWindow: () => r.send("window:maximize"),
  closeWindow: () => r.send("window:close")
};
s.exposeInMainWorld("electronAPI", i);
