"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const os = require("os");
const pidusage = require("pidusage");
const util = require("util");
const https = require("https");
const http = require("http");
const dgram = require("dgram");
const url = require("url");
const net = require("net");
class AppPaths {
  static getPointerPath() {
    const userData = electron.app ? electron.app.getPath("userData") : process.cwd();
    return path.join(userData, "workspace-pointer.json");
  }
  static init() {
    this.cleanUpRoamingFolders();
    const pointerPath = this.getPointerPath();
    if (fs.existsSync(pointerPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(pointerPath, "utf-8"));
        if (data.storageDirectory && fs.existsSync(data.storageDirectory)) {
          const settingsPath = path.join(data.storageDirectory, "app-settings.json");
          if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
            if (settings.setupComplete === true) {
              this.baseDir = data.storageDirectory;
              this.setupComplete = true;
              return;
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse workspace pointer", e);
      }
      try {
        if (fs.existsSync(pointerPath)) fs.unlinkSync(pointerPath);
      } catch {
      }
      this.baseDir = "";
      this.setupComplete = false;
    }
  }
  /**
   * Cleans up any Craftora folders or server files created in the user's Roaming folder.
   */
  static cleanUpRoamingFolders() {
    try {
      const appData = process.env.APPDATA;
      const currentUserData = electron.app ? electron.app.getPath("userData") : "";
      if (appData) {
        const legacyRoaming = path.join(appData, "Craftora");
        if (fs.existsSync(legacyRoaming) && path.resolve(legacyRoaming).toLowerCase() !== path.resolve(currentUserData).toLowerCase()) {
          try {
            fs.rmSync(legacyRoaming, { recursive: true, force: true });
          } catch {
          }
        }
      }
      if (currentUserData && fs.existsSync(currentUserData)) {
        const legacyNested = path.join(currentUserData, "Craftora");
        if (fs.existsSync(legacyNested)) {
          try {
            fs.rmSync(legacyNested, { recursive: true, force: true });
          } catch {
          }
        }
        const legacyServers = path.join(currentUserData, "servers");
        if (fs.existsSync(legacyServers)) {
          try {
            fs.rmSync(legacyServers, { recursive: true, force: true });
          } catch {
          }
        }
      }
    } catch {
    }
  }
  static getSettingsFilePath() {
    return path.join(this.getBaseDir(), "app-settings.json");
  }
  static isSetupComplete() {
    if (!this.baseDir || !this.setupComplete) {
      this.init();
    }
    if (!this.baseDir || !fs.existsSync(this.baseDir)) {
      this.setupComplete = false;
      return false;
    }
    const settingsPath = path.join(this.baseDir, "app-settings.json");
    if (!fs.existsSync(settingsPath)) {
      this.setupComplete = false;
      return false;
    }
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      this.setupComplete = settings.setupComplete === true;
      return this.setupComplete;
    } catch {
      this.setupComplete = false;
      return false;
    }
  }
  static setStorageDir(customPath) {
    this.ensureDir(customPath);
    this.baseDir = customPath;
    this.setupComplete = true;
    const settingsPath = path.join(customPath, "app-settings.json");
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ storageDirectory: customPath, setupComplete: true, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2),
      "utf-8"
    );
    const pointerPath = this.getPointerPath();
    fs.writeFileSync(
      pointerPath,
      JSON.stringify({ storageDirectory: customPath, setupComplete: true }, null, 2),
      "utf-8"
    );
    this.ensureDir(this.getServersDir());
    this.ensureDir(this.getDownloadsDir());
    this.ensureDir(this.getBackupsDir());
    this.cleanUpRoamingFolders();
  }
  /**
   * Validates if a target directory exists and is strictly EMPTY.
   */
  static validateDirectory(targetPath) {
    if (!targetPath || !targetPath.trim()) {
      return { isValid: false, isEmpty: false, error: "Please specify a folder path.", path: targetPath };
    }
    const resolved = path.resolve(targetPath.trim());
    if (!fs.existsSync(resolved)) {
      return { isValid: true, isEmpty: true, path: resolved };
    }
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return { isValid: false, isEmpty: false, error: "The selected path is a file, not a directory.", path: resolved };
      }
      const files = fs.readdirSync(resolved);
      if (files.length > 0) {
        return {
          isValid: false,
          isEmpty: false,
          error: "The selected folder is not empty. Please select or create an empty folder to continue.",
          path: resolved
        };
      }
      return { isValid: true, isEmpty: true, path: resolved };
    } catch (e) {
      return { isValid: false, isEmpty: false, error: `Cannot access folder: ${e.message}`, path: resolved };
    }
  }
  static getBaseDir() {
    if (!this.baseDir) this.init();
    return this.baseDir || "C:\\CraftoraServers";
  }
  static getServersDir() {
    return path.join(this.getBaseDir(), "servers");
  }
  static getDownloadsDir() {
    return path.join(this.getBaseDir(), "downloads");
  }
  static getBackupsDir() {
    return path.join(this.getBaseDir(), "backups");
  }
  static getServerPath(serverId) {
    const sPath = path.join(this.getServersDir(), serverId);
    this.ensureDir(sPath);
    return sPath;
  }
  static getBinDir() {
    return path.join(this.getBaseDir(), "bin");
  }
  static getPluginsCacheDir() {
    return path.join(this.getDownloadsDir(), "plugins");
  }
  static ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
__publicField(AppPaths, "baseDir", "");
__publicField(AppPaths, "setupComplete", false);
class Logger {
  constructor(scope) {
    __publicField(this, "scope");
    this.scope = scope;
  }
  info(...args) {
    console.log(`\x1B[36m[${this.scope}]\x1B[0m`, ...args);
  }
  warn(...args) {
    console.warn(`\x1B[33m[${this.scope}] WARN:\x1B[0m`, ...args);
  }
  error(...args) {
    console.error(`\x1B[31m[${this.scope}] ERROR:\x1B[0m`, ...args);
  }
  debug(...args) {
    console.debug(`\x1B[90m[${this.scope}] DEBUG:\x1B[0m`, ...args);
  }
}
const logger$9 = new Logger("ConfigParser");
class ConfigParserService {
  /**
   * Accepts the Minecraft EULA by writing eula=true into eula.txt.
   */
  static acceptEula(serverDir) {
    const eulaPath = path.join(serverDir, "eula.txt");
    const content = `# Minecraft EULA accepted via Craftora
eula=true
`;
    fs.writeFileSync(eulaPath, content, "utf-8");
    logger$9.info(`EULA accepted for server at: ${serverDir}`);
  }
  /**
   * Reads and parses server.properties.
   */
  static readProperties(serverDir) {
    const propPath = path.join(serverDir, "server.properties");
    const defaultProperties = {
      "server-port": 25565,
      "online-mode": true,
      "motd": "A Craftora Minecraft Server",
      "max-players": 20,
      "difficulty": "normal",
      "gamemode": "survival",
      "pvp": true,
      "hardcore": false,
      "enable-command-block": true,
      "spawn-protection": 16,
      "view-distance": 10,
      "simulation-distance": 10,
      "white-list": false,
      "allow-flight": true,
      "level-name": "world"
    };
    if (!fs.existsSync(propPath)) {
      return defaultProperties;
    }
    try {
      const content = fs.readFileSync(propPath, "utf-8");
      const lines = content.split(/\r?\n/);
      const props = { ...defaultProperties };
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (val === "true") props[key] = true;
          else if (val === "false") props[key] = false;
          else if (/^\d+$/.test(val)) props[key] = parseInt(val, 10);
          else props[key] = val;
        }
      }
      return props;
    } catch (e) {
      logger$9.error("Failed to read server.properties", e);
      return defaultProperties;
    }
  }
  /**
   * Writes updated server.properties while preserving unedited values.
   */
  static writeProperties(serverDir, updatedProps) {
    const propPath = path.join(serverDir, "server.properties");
    const current = this.readProperties(serverDir);
    const merged = { ...current, ...updatedProps };
    const lines = [
      "# Minecraft server properties - Managed by Craftora",
      `# Last updated: ${(/* @__PURE__ */ new Date()).toISOString()}`
    ];
    for (const [key, value] of Object.entries(merged)) {
      lines.push(`${key}=${value}`);
    }
    fs.writeFileSync(propPath, lines.join("\n") + "\n", "utf-8");
    logger$9.info(`server.properties updated for server at: ${serverDir}`);
  }
  /**
   * Sets cracked (offline) mode on or off.
   */
  static setCrackedMode(serverDir, isCracked) {
    this.writeProperties(serverDir, {
      "online-mode": !isCracked
    });
    logger$9.info(`Cracked mode set to: ${isCracked} (online-mode=${!isCracked})`);
  }
}
const execAsync = util.promisify(child_process.exec);
const logger$8 = new Logger("JavaDetector");
class JavaDetectorService {
  static clearCache() {
    this.cachedRuntimes = null;
  }
  /**
   * Discovers all available Java runtimes on the Windows host and in workspace bin.
   * Cached in-memory for instant sub-millisecond responses on repeated queries.
   */
  static async detectJavaRuntimes(forceRefresh = false) {
    if (!forceRefresh && this.cachedRuntimes && this.cachedRuntimes.length > 0) {
      return this.cachedRuntimes;
    }
    const candidateEntries = [];
    const discoveredPaths = /* @__PURE__ */ new Set();
    try {
      const binDir = AppPaths.getBinDir();
      if (fs.existsSync(binDir)) {
        const subdirs = fs.readdirSync(binDir);
        for (const sub of subdirs) {
          const subPath = path.join(binDir, sub);
          const found = this.findJavaInDir(subPath);
          if (found && !discoveredPaths.has(found.toLowerCase())) {
            candidateEntries.push({ path: found });
            discoveredPaths.add(found.toLowerCase());
          }
        }
      }
    } catch {
    }
    candidateEntries.push({ path: "java", isDefault: true });
    discoveredPaths.add("java");
    const javaHome = process.env.JAVA_HOME;
    if (javaHome) {
      const javaExe = path.join(javaHome, "bin", "java.exe");
      if (fs.existsSync(javaExe) && !discoveredPaths.has(javaExe.toLowerCase())) {
        candidateEntries.push({ path: javaExe });
        discoveredPaths.add(javaExe.toLowerCase());
      }
    }
    const commonDirs = [
      "C:\\Program Files\\Java",
      "C:\\Program Files\\Eclipse Adoptium",
      "C:\\Program Files\\BellSoft",
      "C:\\Program Files\\Microsoft\\jdk",
      "C:\\Program Files\\Amazon Corretto",
      "C:\\Program Files\\Zulu",
      "C:\\Program Files (x86)\\Java"
    ];
    for (const baseDir of commonDirs) {
      if (fs.existsSync(baseDir)) {
        try {
          const subdirs = fs.readdirSync(baseDir);
          for (const sub of subdirs) {
            const candidate = path.join(baseDir, sub, "bin", "java.exe");
            if (fs.existsSync(candidate) && !discoveredPaths.has(candidate.toLowerCase())) {
              candidateEntries.push({ path: candidate });
              discoveredPaths.add(candidate.toLowerCase());
            }
          }
        } catch {
        }
      }
    }
    const probePromises = candidateEntries.map(async (entry) => {
      try {
        const runtime = await this.probeJavaPath(entry.path);
        if (runtime) {
          if (entry.isDefault) runtime.isDefault = true;
          return runtime;
        }
      } catch {
      }
      return null;
    });
    const results = (await Promise.all(probePromises)).filter((r) => r !== null);
    const uniqueRuntimes = [];
    const seen = /* @__PURE__ */ new Set();
    for (const r of results) {
      const normalized = r.path.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueRuntimes.push(r);
      }
    }
    this.cachedRuntimes = uniqueRuntimes;
    return uniqueRuntimes;
  }
  /**
   * Runs `java -version` on a given executable path and parses version string.
   */
  static async probeJavaPath(javaExe) {
    try {
      const { stderr, stdout } = await execAsync(`"${javaExe}" -version`);
      const output = (stderr || "") + "\n" + (stdout || "");
      const versionMatch = output.match(/version "([0-9._]+)"/i);
      if (!versionMatch) return null;
      const fullVersion = versionMatch[1];
      let majorVersion = 17;
      if (fullVersion.startsWith("1.")) {
        majorVersion = parseInt(fullVersion.split(".")[1], 10);
      } else {
        majorVersion = parseInt(fullVersion.split(".")[0], 10);
      }
      let vendor = "Unknown";
      if (output.includes("Temurin") || output.includes("Adoptium")) vendor = "Eclipse Temurin";
      else if (output.includes("OpenJDK")) vendor = "OpenJDK";
      else if (output.includes("Oracle")) vendor = "Oracle";
      else if (output.includes("Corretto")) vendor = "Amazon Corretto";
      else if (output.includes("Microsoft")) vendor = "Microsoft";
      else if (output.includes("Zulu")) vendor = "Azul Zulu";
      return {
        path: javaExe,
        version: fullVersion,
        majorVersion,
        isDefault: false,
        vendor
      };
    } catch {
      return null;
    }
  }
  /**
   * Recommends the appropriate Java runtime for a specific Minecraft version.
   */
  static getRecommendedJava(mcVersion, available) {
    if (available.length === 0) return null;
    let targetMajor = 21;
    const parts = mcVersion.split(".");
    const major = parseInt(parts[0], 10) || 1;
    const minor = parts.length > 1 ? parseInt(parts[1], 10) : 20;
    const patch = parts.length > 2 ? parseInt(parts[2], 10) : 0;
    if (major >= 26) {
      targetMajor = 25;
    } else if (major === 1 && (minor >= 21 || minor === 20 && patch >= 5)) {
      targetMajor = 21;
    } else if (major === 1 && minor >= 18) {
      targetMajor = 17;
    } else if (major === 1 && minor >= 17) {
      targetMajor = 16;
    } else {
      targetMajor = 8;
    }
    const exact = available.find((r) => r.majorVersion === targetMajor);
    if (exact) return exact;
    const compatible = available.filter((r) => r.majorVersion >= targetMajor);
    if (compatible.length > 0) {
      return compatible.sort((a, b) => b.majorVersion - a.majorVersion)[0];
    }
    return available[0];
  }
  /**
   * Finds java.exe inside a folder or its single sub-folder.
   */
  static findJavaInDir(dir) {
    if (!fs.existsSync(dir)) return null;
    const direct = path.join(dir, "bin", "java.exe");
    if (fs.existsSync(direct)) return direct;
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const candidate = path.join(dir, item, "bin", "java.exe");
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {
    }
    return null;
  }
  /**
   * Downloads and extracts portable OpenJDK (Java 25 or 21) into workspace bin.
   */
  static async downloadAndExtractPortableJdk(majorVersion = 25, onProgress) {
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    const targetDir = path.join(binDir, `jdk-${majorVersion}`);
    const zipPath = path.join(binDir, `jdk-${majorVersion}.zip`);
    const existingJava = this.findJavaInDir(targetDir);
    if (existingJava) return existingJava;
    const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${majorVersion}/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk`;
    logger$8.info(`Downloading portable OpenJDK ${majorVersion} from ${downloadUrl}...`);
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(zipPath);
      const doRequest = (url2) => {
        https.get(url2, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return doRequest(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download OpenJDK ${majorVersion}: HTTP ${res.statusCode}`));
          }
          const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
          let downloadedBytes = 0;
          res.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (onProgress && totalBytes > 0) {
              onProgress(Math.round(downloadedBytes / totalBytes * 100));
            }
          });
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
        }).on("error", (err) => {
          fs.unlink(zipPath, () => {
          });
          reject(err);
        });
      };
      doRequest(downloadUrl);
    });
    logger$8.info(`Extracting OpenJDK ${majorVersion} to ${targetDir}...`);
    AppPaths.ensureDir(targetDir);
    try {
      await execAsync(`tar -xf "${zipPath}" -C "${targetDir}"`);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      this.clearCache();
      const found = this.findJavaInDir(targetDir);
      logger$8.info(`OpenJDK ${majorVersion} ready at: ${found}`);
      return found;
    } catch (tarErr) {
      try {
        await execAsync(`powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        this.clearCache();
        return this.findJavaInDir(targetDir);
      } catch (psErr) {
        logger$8.error(`Failed to extract OpenJDK ${majorVersion}`, psErr);
        return null;
      }
    }
  }
  /**
   * Downloads and launches the Java 21 JRE installer.
   */
  static async downloadAndInstallJava21(onProgress) {
    const downloadUrl = "https://api.adoptium.net/v3/installer/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk";
    const tempDir = process.env.TEMP || AppPaths.getServersDir();
    const destPath = path.join(tempDir, "OpenJDK21U-jre_x64_windows_hotspot.msi");
    logger$8.info(`Downloading Java 21 installer to ${destPath}`);
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const doRequest = (url2) => {
        https.get(url2, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doRequest(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download Java: ${res.statusCode}`));
          }
          const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
          let downloadedBytes = 0;
          res.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            if (onProgress && totalBytes > 0) {
              onProgress(Math.round(downloadedBytes / totalBytes * 100));
            }
          });
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
        }).on("error", (err) => {
          fs.unlink(destPath, () => {
          });
          reject(err);
        });
      };
      doRequest(downloadUrl);
    });
    logger$8.info(`Launching Java installer: ${destPath}`);
    child_process.spawn("cmd.exe", ["/c", "start", '""', destPath], { detached: true, stdio: "ignore" });
    return true;
  }
}
__publicField(JavaDetectorService, "cachedRuntimes", null);
const logger$7 = new Logger("ServerManager");
class ServerManagerService {
  static setCallbacks(callbacks) {
    this.onLogCallback = callbacks.onLog;
    this.onStatusCallback = callbacks.onStatus;
    this.onMetricsCallback = callbacks.onMetrics;
    this.onPlayersCallback = callbacks.onPlayers;
  }
  /**
   * Generates Aikar's optimized G1GC JVM startup flags based on allocated RAM.
   */
  static buildJvmArguments(ramGb, useAikarFlags = true) {
    const memoryArgs = [`-Xms${ramGb}G`, `-Xmx${ramGb}G`];
    if (!useAikarFlags) {
      return [...memoryArgs, "-jar", "server.jar", "nogui"];
    }
    const aikarFlags = [
      "-XX:+UseG1GC",
      "-XX:+ParallelRefProcEnabled",
      "-XX:MaxGCPauseMillis=200",
      "-XX:+UnlockExperimentalVMOptions",
      "-XX:+DisableExplicitGC",
      "-XX:+AlwaysPreTouch",
      "-XX:G1NewSizePercent=30",
      "-XX:G1MaxNewSizePercent=40",
      "-XX:G1ReservePercent=20",
      "-XX:G1HeapWastePercent=5",
      "-XX:G1MixedGCCountTarget=4",
      "-XX:InitiatingHeapOccupancyPercent=15",
      "-XX:G1MixedGCLiveThresholdPercent=90",
      "-XX:G1RSetUpdatingPauseTimePercent=5",
      "-XX:SurvivorRatio=32",
      "-XX:+PerfDisableSharedMem",
      "-XX:MaxTenuringThreshold=1",
      "-Dusing.aikars.flags=https://mcflags.emc.gs",
      "-Daikars.new.flags=true"
    ];
    return [...memoryArgs, ...aikarFlags, "-jar", "server.jar", "nogui"];
  }
  /**
   * Starts the Minecraft server instance.
   */
  static async startServer(config) {
    var _a, _b;
    if (this.activeProcess || this.status === "STARTING" || this.status === "ONLINE") {
      logger$7.warn("Server is already running or starting");
      return false;
    }
    const jarPath = path.join(config.serverDir, "server.jar");
    if (!fs.existsSync(jarPath)) {
      this.emitLog(`[Craftora] Error: server.jar not found at ${jarPath}`, "system");
      return false;
    }
    ConfigParserService.acceptEula(config.serverDir);
    ConfigParserService.setCrackedMode(config.serverDir, config.isCracked);
    this.activeConfig = config;
    this.setStatus("STARTING");
    this.players.clear();
    this.notifyPlayersChanged();
    let requiredMajor = 21;
    const parts = (config.version || "1.21.4").split(".");
    const mcMajor = parseInt(parts[0], 10) || 1;
    const mcMinor = parts.length > 1 ? parseInt(parts[1], 10) : 20;
    const mcPatch = parts.length > 2 ? parseInt(parts[2], 10) : 0;
    if (mcMajor >= 26) {
      requiredMajor = 25;
    } else if (mcMajor === 1 && (mcMinor >= 21 || mcMinor === 20 && mcPatch >= 5)) {
      requiredMajor = 21;
    } else if (mcMajor === 1 && mcMinor >= 18) {
      requiredMajor = 17;
    }
    let javaExecutable = config.javaPath || "java";
    let currentJava = await JavaDetectorService.probeJavaPath(javaExecutable);
    if (!currentJava || currentJava.majorVersion < requiredMajor) {
      this.emitLog(`[Craftora] Minecraft ${config.version} requires Java ${requiredMajor}+ (Selected: ${currentJava ? `Java ${currentJava.majorVersion}` : "Default PATH"}). Searching for compatible runtime...`, "system");
      const allRuntimes = await JavaDetectorService.detectJavaRuntimes();
      const compatible = allRuntimes.find((r) => r.majorVersion >= requiredMajor);
      if (compatible) {
        javaExecutable = compatible.path;
        config.javaPath = compatible.path;
        this.emitLog(`[Craftora] Auto-selected compatible Java ${compatible.majorVersion} (${compatible.path})`, "system");
      } else {
        this.emitLog(`[Craftora] Downloading portable OpenJDK ${requiredMajor} to workspace...`, "system");
        const downloadedJava = await JavaDetectorService.downloadAndExtractPortableJdk(requiredMajor, (pct) => {
          this.emitLog(`[Craftora] Downloading Java ${requiredMajor}... ${pct}%`, "system");
        });
        if (downloadedJava) {
          javaExecutable = downloadedJava;
          config.javaPath = downloadedJava;
          this.emitLog(`[Craftora] Portable Java ${requiredMajor} is ready! Launching server...`, "system");
        } else {
          this.emitLog(`[Craftora] Warning: Could not auto-download Java ${requiredMajor}. Attempting launch with current runtime...`, "system");
        }
      }
    }
    const jvmArgs = this.buildJvmArguments(config.allocatedRamGb, config.useAikarFlags);
    this.emitLog(`[Craftora] Launching ${config.serverSoftware.toUpperCase()} (${config.version}) with ${config.allocatedRamGb}GB RAM...`, "system");
    this.emitLog(`[Craftora] Java: ${javaExecutable}`, "system");
    try {
      this.activeProcess = child_process.spawn(javaExecutable, jvmArgs, {
        cwd: config.serverDir,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.startTime = Date.now();
      (_a = this.activeProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
        const lines = data.toString().split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          this.parseServerLogLine(line);
          this.emitLog(line, "stdout");
        }
      });
      (_b = this.activeProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
        const lines = data.toString().split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          this.emitLog(line, "stderr");
        }
      });
      this.activeProcess.on("exit", (code, signal) => {
        logger$7.info(`Server process exited with code ${code}, signal ${signal}`);
        this.emitLog(`[Craftora] Server stopped with exit code: ${code}`, "system");
        this.cleanUpProcess();
        this.setStatus("STOPPED");
      });
      this.activeProcess.on("error", (err) => {
        logger$7.error("Failed to spawn server process", err);
        this.emitLog(`[Craftora] Process error: ${err.message}`, "system");
        this.cleanUpProcess();
        this.setStatus("CRASHED");
      });
      this.startMetricsMonitor();
      return true;
    } catch (err) {
      logger$7.error("Failed to start server", err);
      this.emitLog(`[Craftora] Start error: ${err.message}`, "system");
      this.setStatus("CRASHED");
      return false;
    }
  }
  /**
   * Gracefully stops the server by issuing the "stop" command.
   */
  static stopServer() {
    return new Promise((resolve) => {
      var _a;
      if (!this.activeProcess || this.status === "STOPPED") {
        this.setStatus("STOPPED");
        return resolve(true);
      }
      this.setStatus("STOPPING");
      this.emitLog("[Craftora] Sending graceful stop command to server...", "system");
      try {
        (_a = this.activeProcess.stdin) == null ? void 0 : _a.write("stop\n");
      } catch (e) {
        logger$7.warn("Failed to write stop command, terminating process", e);
        this.activeProcess.kill("SIGTERM");
      }
      const forceTimeout = setTimeout(() => {
        if (this.activeProcess) {
          this.emitLog("[Craftora] Server hung on shutdown. Force terminating...", "system");
          this.activeProcess.kill("SIGKILL");
        }
        resolve(true);
      }, 15e3);
      this.activeProcess.once("exit", () => {
        clearTimeout(forceTimeout);
        resolve(true);
      });
    });
  }
  /**
   * Immediately kills the server process.
   */
  static killServer() {
    if (this.activeProcess) {
      this.emitLog("[Craftora] Killing server process...", "system");
      this.activeProcess.kill("SIGKILL");
      this.cleanUpProcess();
      this.setStatus("STOPPED");
    }
  }
  /**
   * Sends an interactive command to the server console.
   */
  static sendCommand(cmd) {
    var _a;
    if (!this.activeProcess || this.status !== "ONLINE") {
      this.emitLog(`[Craftora] Cannot send command: Server is not online.`, "system");
      return false;
    }
    try {
      this.emitLog(`> ${cmd}`, "system");
      (_a = this.activeProcess.stdin) == null ? void 0 : _a.write(`${cmd}
`);
      return true;
    } catch (e) {
      logger$7.error("Failed to send command", e);
      return false;
    }
  }
  /**
   * Parses log stream for in-game events: ready signal, player logins/logouts.
   */
  static parseServerLogLine(line) {
    if (line.includes("Done (") && line.includes('For help, type "help"')) {
      this.setStatus("ONLINE");
      this.emitLog("[Craftora] Server is ONLINE and accepting connections! ✨", "system");
      this.applyGamerules();
    }
    const joinMatch = line.match(/(?:INFO\]:\s+)?([a-zA-Z0-9_]{3,16})(?:\[\/([0-9.]+):(\d+)\])?\s+(?:logged in with entity id|joined the game)/);
    if (joinMatch) {
      const username = joinMatch[1];
      const ip = joinMatch[2] || void 0;
      if (!this.players.has(username)) {
        this.players.set(username, {
          username,
          ip,
          joinedAt: Date.now()
        });
        this.notifyPlayersChanged();
      }
    }
    const leaveMatch = line.match(/(?:INFO\]:\s+)?([a-zA-Z0-9_]{3,16})\s+(?:left the game|lost connection)/);
    if (leaveMatch) {
      const username = leaveMatch[1];
      if (this.players.has(username)) {
        this.players.delete(username);
        this.notifyPlayersChanged();
      }
    }
  }
  /**
   * Applies user-configured gameplay gamerules (keepInventory, showCoordinates, sleep percentage, etc.).
   */
  static applyGamerules() {
    if (!this.activeConfig) return;
    setTimeout(() => {
      if (!this.activeConfig || this.status !== "ONLINE") return;
      if (this.activeConfig.keepInventory !== void 0) {
        const val = this.activeConfig.keepInventory ? "true" : "false";
        this.sendCommand(`gamerule keepInventory ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: keepInventory = ${val}`, "system");
      }
      if (this.activeConfig.showCoordinates !== void 0) {
        const val = this.activeConfig.showCoordinates ? "true" : "false";
        this.sendCommand(`gamerule showCoordinates ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: showCoordinates = ${val}`, "system");
      }
      if (this.activeConfig.onePlayerSleep !== void 0) {
        const pct = this.activeConfig.onePlayerSleep ? 1 : 100;
        this.sendCommand(`gamerule playersSleepingPercentage ${pct}`);
        this.emitLog(`[Craftora] Applied gamerule: playersSleepingPercentage = ${pct}%`, "system");
      }
      if (this.activeConfig.disableMobGriefing !== void 0) {
        const val = this.activeConfig.disableMobGriefing ? "false" : "true";
        this.sendCommand(`gamerule mobGriefing ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: mobGriefing = ${val}`, "system");
      }
      if (this.activeConfig.disableFireSpread !== void 0) {
        const val = this.activeConfig.disableFireSpread ? "false" : "true";
        this.sendCommand(`gamerule doFireTick ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: doFireTick = ${val}`, "system");
      }
    }, 1500);
  }
  /**
   * Periodically queries pidusage for CPU and RAM consumption.
   */
  static startMetricsMonitor() {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = setInterval(async () => {
      var _a;
      if (!this.activeProcess || !this.activeProcess.pid || this.status === "STOPPED") {
        return;
      }
      try {
        const stats = await pidusage(this.activeProcess.pid);
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1e3);
        const cpuCores = Math.max(1, os.cpus().length || 1);
        const normalizedCpu = Math.min(100, Math.max(0, Math.round(stats.cpu / cpuCores * 10) / 10));
        this.currentMetrics = {
          cpu: normalizedCpu,
          memoryMb: Math.round(stats.memory / (1024 * 1024)),
          tps: 20,
          // Stable TPS estimate
          onlinePlayers: this.players.size,
          maxPlayers: ((_a = this.activeConfig) == null ? void 0 : _a.port) ? 20 : 20,
          uptimeSeconds
        };
        if (this.onMetricsCallback) {
          this.onMetricsCallback({ ...this.currentMetrics });
        }
      } catch (e) {
      }
    }, 3e3);
  }
  static cleanUpProcess() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.flushLogs();
    this.activeProcess = null;
    this.players.clear();
    this.notifyPlayersChanged();
    this.currentMetrics = {
      cpu: 0,
      memoryMb: 0,
      tps: 20,
      onlinePlayers: 0,
      maxPlayers: 20,
      uptimeSeconds: 0
    };
    if (this.onMetricsCallback) {
      this.onMetricsCallback(this.currentMetrics);
    }
  }
  static setStatus(newStatus) {
    this.status = newStatus;
    if (this.onStatusCallback) {
      this.onStatusCallback(newStatus);
    }
  }
  static emitLog(line, type) {
    this.logBatch.push({ line, type });
    if (this.logBatch.length >= 25) {
      this.flushLogs();
    } else if (!this.logFlushTimer) {
      this.logFlushTimer = setTimeout(() => {
        this.flushLogs();
      }, 50);
    }
  }
  static flushLogs() {
    if (this.logFlushTimer) {
      clearTimeout(this.logFlushTimer);
      this.logFlushTimer = null;
    }
    if (this.logBatch.length === 0) return;
    const batch = [...this.logBatch];
    this.logBatch = [];
    if (this.onLogCallback) {
      this.onLogCallback(batch);
    }
  }
  static notifyPlayersChanged() {
    if (this.onPlayersCallback) {
      this.onPlayersCallback(Array.from(this.players.values()));
    }
  }
  static getStatus() {
    return this.status;
  }
  static getMetrics() {
    return { ...this.currentMetrics };
  }
  static getPlayers() {
    return Array.from(this.players.values());
  }
  static getActiveConfig() {
    return this.activeConfig;
  }
}
__publicField(ServerManagerService, "activeProcess", null);
__publicField(ServerManagerService, "status", "STOPPED");
__publicField(ServerManagerService, "activeConfig", null);
__publicField(ServerManagerService, "startTime", 0);
__publicField(ServerManagerService, "monitorTimer", null);
__publicField(ServerManagerService, "players", /* @__PURE__ */ new Map());
__publicField(ServerManagerService, "currentMetrics", {
  cpu: 0,
  memoryMb: 0,
  tps: 20,
  onlinePlayers: 0,
  maxPlayers: 20,
  uptimeSeconds: 0
});
// Event callbacks
__publicField(ServerManagerService, "onLogCallback");
__publicField(ServerManagerService, "onStatusCallback");
__publicField(ServerManagerService, "onMetricsCallback");
__publicField(ServerManagerService, "onPlayersCallback");
__publicField(ServerManagerService, "logBatch", []);
__publicField(ServerManagerService, "logFlushTimer", null);
const logger$6 = new Logger("JarDownloader");
class JarDownloaderService {
  /**
   * Helper to check if a version string is >= 1.12.2 and is a clean release.
   */
  static isSupportedVersion(v) {
    if (!v || typeof v !== "string") return false;
    if (v.includes("pre") || v.includes("rc") || v.includes("snapshot") || v.includes("w") || v.includes("alpha") || v.includes("beta")) {
      return false;
    }
    const parts = v.split(".").map((p) => parseInt(p, 10));
    if (parts.length === 0 || isNaN(parts[0])) return false;
    if (parts[0] >= 2) return true;
    if (parts[0] === 1) {
      if (parts[1] > 12) return true;
      if (parts[1] === 12) {
        return (parts[2] || 0) >= 2;
      }
    }
    return false;
  }
  /**
   * Semver comparator for Minecraft versions (e.g. 26.2 > 26.1.2 > 1.21.11 > 1.21.4 > 1.12.2).
   */
  static compareVersions(a, b) {
    const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
    const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) {
        return nb - na;
      }
    }
    return 0;
  }
  /**
   * Fetches available Minecraft versions for a selected server software (Latest down to 1.12.2).
   */
  static async getAvailableVersions(software) {
    try {
      if (software === "paper") {
        const res = await this.fetchJson("https://fill.papermc.io/v3/projects/paper");
        if (res && res.versions) {
          const list = Object.values(res.versions).flat().filter((v) => this.isSupportedVersion(v));
          if (list.length > 0) {
            const unique = Array.from(new Set(list));
            return unique.sort(this.compareVersions);
          }
        }
      } else if (software === "purpur") {
        const res = await this.fetchJson("https://api.purpurmc.org/v2/purpur");
        if (res && res.versions) {
          const list = res.versions.filter((v) => this.isSupportedVersion(v));
          if (list.length > 0) {
            const unique = Array.from(new Set(list));
            return unique.sort(this.compareVersions);
          }
        }
      } else if (software === "vanilla") {
        const manifest = await this.fetchJson(
          "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
        );
        const list = manifest.versions.filter((v) => v.type === "release" && this.isSupportedVersion(v.id)).map((v) => v.id);
        if (list.length > 0) {
          const unique = Array.from(new Set(list));
          return unique.sort(this.compareVersions);
        }
      } else if (software === "fabric") {
        const res = await this.fetchJson("https://meta.fabricmc.net/v2/versions/game");
        const list = res.filter((v) => v.stable && this.isSupportedVersion(v.version)).map((v) => v.version);
        if (list.length > 0) {
          const unique = Array.from(new Set(list));
          return unique.sort(this.compareVersions);
        }
      }
    } catch (err) {
      logger$6.error("Failed to fetch versions for " + software, err);
    }
    return [
      "26.2",
      "26.1.2",
      "26.1.1",
      "1.21.11",
      "1.21.10",
      "1.21.9",
      "1.21.8",
      "1.21.7",
      "1.21.6",
      "1.21.5",
      "1.21.4",
      "1.21.3",
      "1.21.1",
      "1.21",
      "1.20.6",
      "1.20.4",
      "1.20.2",
      "1.20.1",
      "1.20",
      "1.19.4",
      "1.19.3",
      "1.19.2",
      "1.19",
      "1.18.2",
      "1.18.1",
      "1.17.1",
      "1.16.5",
      "1.15.2",
      "1.14.4",
      "1.13.2",
      "1.12.2"
    ];
  }
  /**
   * Downloads the server jar file for the specified software and version.
   */
  static async downloadServerJar(software, version, targetDirectory, onProgress) {
    AppPaths.ensureDir(targetDirectory);
    const targetJarName = "server.jar";
    const targetPath = path.join(targetDirectory, targetJarName);
    logger$6.info(`Resolving download URL for ${software} ${version}...`);
    const downloadUrl = await this.resolveDownloadUrl(software, version);
    logger$6.info(`Downloading jar from: ${downloadUrl}`);
    await this.downloadFile(downloadUrl, targetPath, (percent, downloadedBytes, totalBytes) => {
      if (onProgress) {
        onProgress({
          software,
          version,
          percent,
          downloadedBytes,
          totalBytes
        });
      }
    });
    logger$6.info(`Server jar downloaded successfully to: ${targetPath}`);
    return targetPath;
  }
  /**
   * Resolves the direct download URL for the jar file.
   */
  static async resolveDownloadUrl(software, version) {
    var _a, _b, _c, _d;
    if (software === "paper") {
      try {
        const versionData = await this.fetchJson(
          `https://fill.papermc.io/v3/projects/paper/versions/${version}`
        );
        if (versionData.builds && versionData.builds.length > 0) {
          const latestBuild2 = versionData.builds[0];
          const buildData2 = await this.fetchJson(
            `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/${latestBuild2}`
          );
          if ((_b = (_a = buildData2 == null ? void 0 : buildData2.downloads) == null ? void 0 : _a["server:default"]) == null ? void 0 : _b.url) {
            return buildData2.downloads["server:default"].url;
          }
        }
      } catch (v3Err) {
        logger$6.warn("Paper V3 lookup failed, attempting V2 endpoint", v3Err);
      }
      const v2Data = await this.fetchJson(
        `https://api.papermc.io/v2/projects/paper/versions/${version}`
      );
      if (!v2Data.builds || v2Data.builds.length === 0) {
        throw new Error(`No builds found for Paper version ${version}`);
      }
      const latestBuild = v2Data.builds[v2Data.builds.length - 1];
      const buildData = await this.fetchJson(
        `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}`
      );
      return `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}/downloads/${buildData.downloads.application.name}`;
    }
    if (software === "purpur") {
      const buildsData = await this.fetchJson(
        `https://api.purpurmc.org/v2/purpur/${version}`
      );
      return `https://api.purpurmc.org/v2/purpur/${version}/${buildsData.builds.latest}/download`;
    }
    if (software === "vanilla") {
      const manifest = await this.fetchJson(
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
      );
      const versionEntry = manifest.versions.find((v) => v.id === version);
      if (!versionEntry) throw new Error(`Vanilla version ${version} not found`);
      const versionData = await this.fetchJson(versionEntry.url);
      return versionData.downloads.server.url;
    }
    if (software === "fabric") {
      const loaderRes = await this.fetchJson(
        `https://meta.fabricmc.net/v2/versions/loader/${version}`
      );
      const loaderVer = ((_d = (_c = loaderRes[0]) == null ? void 0 : _c.loader) == null ? void 0 : _d.version) || "0.16.9";
      const installerVer = "1.0.1";
      return `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVer}/${installerVer}/server/jar`;
    }
    throw new Error(`Unsupported software: ${software}`);
  }
  /**
   * Generic file downloader with redirect handling and byte stream progress.
   */
  static downloadFile(url2, destPath, onProgress) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const client = url2.startsWith("https") ? https : http;
      const request = client.get(url2, { headers: { "User-Agent": "Craftora/1.0.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          try {
            const redirectUrl = new URL(res.headers.location, url2).href;
            return this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
          } catch (urlErr) {
            return reject(new Error(`Invalid redirect URL: ${res.headers.location}`));
          }
        }
        if (res.statusCode !== 200) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return reject(new Error(`Server returned HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let downloadedBytes = 0;
        res.on("data", (chunk) => {
          downloadedBytes += chunk.length;
          const percent = totalBytes > 0 ? Math.round(downloadedBytes / totalBytes * 100) : 0;
          if (onProgress) {
            onProgress(percent, downloadedBytes, totalBytes);
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => resolve());
        });
      });
      request.on("error", (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }
  /**
   * Helper to fetch JSON from HTTPS API endpoint.
   */
  static fetchJson(url2) {
    return new Promise((resolve, reject) => {
      https.get(url2, { headers: { "User-Agent": "Craftora/1.0.0" } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            const redirectUrl = new URL(res.headers.location, url2).href;
            return this.fetchJson(redirectUrl).then(resolve).catch(reject);
          } catch (urlErr) {
            return reject(new Error(`Invalid redirect URL: ${res.headers.location}`));
          }
        }
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON response from ${url2}: ${e}`));
          }
        });
      }).on("error", reject);
    });
  }
}
function registerServerIpc(mainWindow2) {
  ServerManagerService.setCallbacks({
    onLog: (logs) => {
      if (!mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("server:log", logs);
      }
    },
    onStatus: (status) => {
      if (!mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("server:status-changed", status);
      }
    },
    onMetrics: (metrics) => {
      if (!mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("server:metrics-updated", metrics);
      }
    },
    onPlayers: (players) => {
      if (!mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("server:players-updated", players);
      }
    }
  });
  electron.ipcMain.handle("server:start", async (_, config) => {
    return await ServerManagerService.startServer(config);
  });
  electron.ipcMain.handle("server:stop", async () => {
    return await ServerManagerService.stopServer();
  });
  electron.ipcMain.handle("server:kill", async () => {
    ServerManagerService.killServer();
    return true;
  });
  electron.ipcMain.handle("server:send-command", async (_, cmd) => {
    return ServerManagerService.sendCommand(cmd);
  });
  electron.ipcMain.handle("server:get-status", () => {
    return ServerManagerService.getStatus();
  });
  electron.ipcMain.handle("server:get-metrics", () => {
    return ServerManagerService.getMetrics();
  });
  electron.ipcMain.handle("server:get-players", () => {
    return ServerManagerService.getPlayers();
  });
  electron.ipcMain.handle("java:detect-all", async () => {
    return await JavaDetectorService.detectJavaRuntimes();
  });
  electron.ipcMain.handle("java:install-21", async () => {
    return await JavaDetectorService.downloadAndInstallJava21((percent) => {
      if (!mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("java:install-progress", percent);
      }
    });
  });
  electron.ipcMain.handle("jars:get-versions", async (_, software) => {
    return await JarDownloaderService.getAvailableVersions(software);
  });
  electron.ipcMain.handle("jars:download-jar", async (_, { software, version, serverId }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return await JarDownloaderService.downloadServerJar(software, version, serverDir, (progress) => {
      if (!mainWindow2.isDestroyed()) {
        mainWindow2.webContents.send("jars:download-progress", progress);
      }
    });
  });
}
const logger$5 = new Logger("UpnpService");
class UpnpService {
  /**
   * Discovers local network IPv4 address.
   */
  static getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("127.")) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  }
  /**
   * Discovers UPnP IGD (Internet Gateway Device) via SSDP M-SEARCH broadcast.
   */
  static discoverIgd(timeoutMs = 3500) {
    return new Promise((resolve) => {
      const socket = dgram.createSocket("udp4");
      let resolved = false;
      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        try {
          socket.close();
        } catch {
        }
        resolve(result);
      };
      const timer = setTimeout(() => {
        finish(null);
      }, timeoutMs);
      socket.on("error", (err) => {
        logger$5.warn("SSDP UDP socket error", err);
        clearTimeout(timer);
        finish(null);
      });
      socket.on("message", (msg) => {
        const text = msg.toString("utf-8");
        if (text.includes("LOCATION:") || text.includes("location:")) {
          const match = text.match(/LOCATION:\s*(http[^\r\n]+)/i);
          if (match && match[1]) {
            clearTimeout(timer);
            finish(match[1].trim());
          }
        }
      });
      socket.bind(0, () => {
        try {
          socket.setBroadcast(true);
          const searchTargets = [
            "urn:schemas-upnp-org:device:InternetGatewayDevice:1",
            "urn:schemas-upnp-org:service:WANIPConnection:1",
            "urn:schemas-upnp-org:service:WANPPPConnection:1",
            "ssdp:all"
          ];
          for (const target of searchTargets) {
            const query = Buffer.from(
              `M-SEARCH * HTTP/1.1\r
HOST: 239.255.255.250:1900\r
MAN: "ssdp:discover"\r
MX: 3\r
ST: ${target}\r
\r
`
            );
            socket.send(query, 0, query.length, 1900, "239.255.255.250");
          }
        } catch (e) {
          logger$5.warn("Failed to send SSDP query", e);
          clearTimeout(timer);
          finish(null);
        }
      });
    });
  }
  /**
   * Fetches the IGD root XML description and extracts WANIPConnection / WANPPPConnection control URL.
   */
  static fetchXml(locationUrl) {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new url.URL(locationUrl);
        const req = http.get(parsed, { timeout: 3e3 }, (res) => {
          let data = "";
          res.on("data", (chunk) => data += chunk);
          res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("IGD XML fetch timed out"));
        });
      } catch (err) {
        reject(err);
      }
    });
  }
  /**
   * Resolves IGD Control URL and Service Type from the router descriptor.
   */
  static async resolveIgdEndpoint(forceRefresh = false) {
    if (this.cachedEndpoint && !forceRefresh) {
      return this.cachedEndpoint;
    }
    try {
      const location = await this.discoverIgd();
      if (!location) {
        return null;
      }
      const xml = await this.fetchXml(location);
      const parsedLocation = new url.URL(location);
      const baseUrl = `${parsedLocation.protocol}//${parsedLocation.host}`;
      let friendlyName = "Local Router Gateway";
      const nameMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
      if (nameMatch && nameMatch[1]) {
        friendlyName = nameMatch[1].trim();
      }
      const services = [
        "urn:schemas-upnp-org:service:WANIPConnection:1",
        "urn:schemas-upnp-org:service:WANIPConnection:2",
        "urn:schemas-upnp-org:service:WANPPPConnection:1",
        "urn:schemas-upnp-org:service:WANPPPConnection:2"
      ];
      for (const serviceType of services) {
        if (xml.includes(serviceType)) {
          const serviceBlockRegex = new RegExp(`<service>[\\s\\S]*?<serviceType>${serviceType}<\\/serviceType>[\\s\\S]*?<controlURL>([^<]+)<\\/controlURL>[\\s\\S]*?<\\/service>`, "i");
          const match = xml.match(serviceBlockRegex);
          if (match && match[1]) {
            let controlUrl = match[1].trim();
            if (!controlUrl.startsWith("http")) {
              if (!controlUrl.startsWith("/")) controlUrl = `/${controlUrl}`;
              controlUrl = `${baseUrl}${controlUrl}`;
            }
            this.cachedEndpoint = {
              controlUrl,
              serviceType,
              baseUrl,
              friendlyName
            };
            return this.cachedEndpoint;
          }
        }
      }
      return null;
    } catch (e) {
      logger$5.warn("Failed to resolve UPnP IGD endpoint", e);
      return null;
    }
  }
  /**
   * Executes a SOAP action against the router's UPnP service.
   */
  static sendSoapAction(endpoint, action, args) {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new url.URL(endpoint.controlUrl);
        let argXml = "";
        for (const [k, v] of Object.entries(args)) {
          argXml += `<${k}>${v}</${k}>
`;
        }
        const body = `<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="${endpoint.serviceType}">
      ${argXml}    </u:${action}>
  </s:Body>
</s:Envelope>`;
        const postData = Buffer.from(body, "utf-8");
        const req = http.request(
          {
            hostname: urlObj.hostname,
            port: urlObj.port ? parseInt(urlObj.port) : 80,
            path: `${urlObj.pathname}${urlObj.search}`,
            method: "POST",
            headers: {
              "Content-Type": 'text/xml; charset="utf-8"',
              "Content-Length": postData.length,
              "SOAPAction": `"${endpoint.serviceType}#${action}"`,
              "Connection": "Close"
            },
            timeout: 4e3
          },
          (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(data);
              } else {
                reject(new Error(`SOAP request failed (${res.statusCode}): ${data}`));
              }
            });
          }
        );
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("SOAP request timed out"));
        });
        req.write(postData);
        req.end();
      } catch (e) {
        reject(e);
      }
    });
  }
  /**
   * Queries router for External Public IP.
   */
  static async getExternalIpFromRouter(endpoint) {
    try {
      const response = await this.sendSoapAction(endpoint, "GetExternalIPAddress", {});
      const match = response.match(/<NewExternalIPAddress>([^<]+)<\/NewExternalIPAddress>/i);
      if (match && match[1] && match[1].trim() !== "0.0.0.0") {
        return match[1].trim();
      }
    } catch (e) {
      logger$5.warn("Failed to query router External IP via UPnP", e);
    }
    return null;
  }
  /**
   * Probes the local network router to verify if UPnP IGD is supported and active.
   */
  static async checkSupport(forceRefresh = false) {
    if (this.supportChecked && !forceRefresh) {
      return { ...this.currentStatus };
    }
    if (this.probePromise && !forceRefresh) {
      return this.probePromise;
    }
    this.probePromise = (async () => {
      try {
        logger$5.info("Probing local router for UPnP IGD capability...");
        const endpoint = await this.resolveIgdEndpoint(forceRefresh);
        if (!endpoint) {
          this.supportChecked = true;
          this.isSupportedCached = false;
          this.unsupportedReasonCached = "UPnP is unavailable or disabled on your current network gateway. Your router or ISP does not allow automatic port mapping.";
          this.currentStatus = {
            ...this.currentStatus,
            isSupported: false,
            unsupportedReason: this.unsupportedReasonCached,
            error: null
          };
          logger$5.info("UPnP not supported on current gateway.");
          return { ...this.currentStatus };
        }
        const externalIp = await this.getExternalIpFromRouter(endpoint);
        this.supportChecked = true;
        this.isSupportedCached = true;
        this.unsupportedReasonCached = null;
        this.currentStatus = {
          ...this.currentStatus,
          isSupported: true,
          routerName: endpoint.friendlyName || "Active UPnP Gateway",
          externalIp: externalIp || this.currentStatus.externalIp,
          unsupportedReason: null,
          error: null
        };
        logger$5.info(`UPnP is supported on router (${endpoint.friendlyName}), ExtIP: ${externalIp}`);
        return { ...this.currentStatus };
      } catch (err) {
        this.supportChecked = true;
        this.isSupportedCached = false;
        this.unsupportedReasonCached = "UPnP discovery failed on your local network. Please ensure UPnP is enabled on your router.";
        this.currentStatus = {
          ...this.currentStatus,
          isSupported: false,
          unsupportedReason: this.unsupportedReasonCached,
          error: err.message
        };
        return { ...this.currentStatus };
      } finally {
        this.probePromise = null;
      }
    })();
    return this.probePromise;
  }
  /**
   * Opens / forwards server port on the router via UPnP.
   */
  static async openPort(port = 25565, protocol = "TCP", description = "Craftora Minecraft Server") {
    try {
      const endpoint = await this.resolveIgdEndpoint();
      if (!endpoint) {
        return {
          isSupported: false,
          isActive: false,
          externalIp: null,
          mappedPort: null,
          error: "Cannot open port: UPnP is not supported or disabled on your router.",
          unsupportedReason: "UPnP is disabled on this network router."
        };
      }
      const localIp = this.getLocalIp();
      logger$5.info(`Forwarding UPnP ${protocol} port ${port} -> ${localIp}:${port}...`);
      await this.sendSoapAction(endpoint, "AddPortMapping", {
        NewRemoteHost: "",
        NewExternalPort: port.toString(),
        NewProtocol: protocol,
        NewInternalPort: port.toString(),
        NewInternalClient: localIp,
        NewEnabled: "1",
        NewPortMappingDescription: description,
        NewLeaseDuration: "0"
      });
      const extIp = await this.getExternalIpFromRouter(endpoint) || this.currentStatus.externalIp;
      this.currentStatus = {
        isSupported: true,
        isActive: true,
        externalIp: extIp,
        mappedPort: port,
        routerName: endpoint.friendlyName,
        error: null,
        unsupportedReason: null
      };
      logger$5.info(`UPnP Port ${port} successfully opened! Join address: ${extIp}:${port}`);
      return { ...this.currentStatus };
    } catch (err) {
      logger$5.error("Failed to open UPnP port mapping", err);
      this.currentStatus = {
        ...this.currentStatus,
        isActive: false,
        error: `UPnP Port Forwarding failed: ${err.message || "Unknown error"}`
      };
      return { ...this.currentStatus };
    }
  }
  /**
   * Closes / releases the UPnP port mapping on the router.
   */
  static async closePort(port = 25565, protocol = "TCP") {
    try {
      if (this.cachedEndpoint && this.currentStatus.isActive) {
        logger$5.info(`Releasing UPnP port mapping ${protocol} ${port}...`);
        await this.sendSoapAction(this.cachedEndpoint, "DeletePortMapping", {
          NewRemoteHost: "",
          NewExternalPort: port.toString(),
          NewProtocol: protocol
        });
      }
    } catch (e) {
      logger$5.warn("Failed to delete UPnP port mapping cleanly", e);
    }
    this.currentStatus = {
      ...this.currentStatus,
      isActive: false,
      mappedPort: null,
      error: null
    };
    return { ...this.currentStatus };
  }
  /**
   * Returns current UPnP state.
   */
  static getStatus() {
    return { ...this.currentStatus };
  }
}
__publicField(UpnpService, "cachedEndpoint", null);
__publicField(UpnpService, "supportChecked", false);
__publicField(UpnpService, "isSupportedCached", false);
__publicField(UpnpService, "unsupportedReasonCached", null);
__publicField(UpnpService, "currentStatus", {
  isSupported: false,
  isActive: false,
  externalIp: null,
  mappedPort: null,
  routerName: null,
  error: null,
  unsupportedReason: null
});
__publicField(UpnpService, "probePromise", null);
const logger$4 = new Logger("PlayitService");
class PlayitService {
  /**
   * Registers a callback for real-time status updates.
   */
  static onStatusChange(callback) {
    this.onStatusChangeListeners.push(callback);
    return () => {
      this.onStatusChangeListeners = this.onStatusChangeListeners.filter((l) => l !== callback);
    };
  }
  static updateStatus(partial) {
    this.currentStatus = { ...this.currentStatus, ...partial };
    for (const listener of this.onStatusChangeListeners) {
      try {
        listener({ ...this.currentStatus });
      } catch (e) {
        logger$4.warn("Error in status listener", e);
      }
    }
  }
  /**
   * Returns path to the portable playit executable.
   */
  static getBinaryPath() {
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    return path.join(binDir, "playit.exe");
  }
  /**
   * Checks if the playit binary exists on disk.
   */
  static isBinaryInstalled() {
    const binPath = this.getBinaryPath();
    if (!fs.existsSync(binPath)) return false;
    const size = fs.statSync(binPath).size;
    if (size < 1024 * 1024) return false;
    if (size > 5 * 1024 * 1024) {
      logger$4.warn("Detected oversized playit daemon binary (v1.0.10) — removing and scheduling re-download of v0.17.1");
      try {
        fs.unlinkSync(binPath);
      } catch {
      }
      return false;
    }
    return true;
  }
  /**
   * Checks if PlayIt.gg is already claimed and has a saved secret key.
   */
  static isClaimed() {
    const { secretKey } = this.getSecretKey();
    return !!secretKey;
  }
  /**
   * Downloads the official playit agent binary if not present.
   */
  static async ensureBinary(onProgress) {
    if (this.isBinaryInstalled()) {
      return true;
    }
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    const binPath = this.getBinaryPath();
    const downloadUrl = "https://github.com/playit-cloud/playit-agent/releases/download/v0.17.1/playit-windows-x86_64-signed.exe";
    logger$4.info(`Downloading official playit tunnel binary to: ${binPath}`);
    if (onProgress) onProgress(10, "Downloading PlayIt.gg Agent...");
    return new Promise((resolve, reject) => {
      const tempPath = `${binPath}.tmp`;
      const downloadFileWithRedirects = (url2, redirectsRemaining = 5) => {
        if (redirectsRemaining <= 0) {
          reject(new Error("Too many redirects while downloading PlayIt.gg agent."));
          return;
        }
        https.get(url2, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            downloadFileWithRedirects(res.headers.location, redirectsRemaining - 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download agent. HTTP status: ${res.statusCode}`));
            return;
          }
          const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
          let receivedBytes = 0;
          const fileStream = fs.createWriteStream(tempPath);
          res.on("data", (chunk) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              const percent = Math.min(100, Math.round(receivedBytes / totalBytes * 100));
              onProgress(percent, `Downloading PlayIt.gg Agent... ${percent}%`);
            }
          });
          res.pipe(fileStream);
          fileStream.on("finish", () => {
            fileStream.close(() => {
              try {
                if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
                fs.renameSync(tempPath, binPath);
                logger$4.info("PlayIt.gg Agent binary downloaded successfully.");
                if (onProgress) onProgress(100, "PlayIt.gg Agent ready!");
                resolve(true);
              } catch (e) {
                reject(e);
              }
            });
          });
          fileStream.on("error", (err) => {
            try {
              if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch {
            }
            reject(err);
          });
        }).on("error", (err) => {
          try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          } catch {
          }
          reject(err);
        });
      };
      downloadFileWithRedirects(downloadUrl);
    });
  }
  /**
   * Helper to make HTTPS requests to the playit.gg API.
   */
  static async apiRequest(endpoint, data = {}, secretKey) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "playit-agent/1.0.10"
      };
      if (secretKey) {
        headers["Authorization"] = `agent-key ${secretKey}`;
      }
      const req = https.request(`https://api.playit.gg${endpoint}`, {
        method: "POST",
        headers,
        timeout: 1e4
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            resolve({ status: "raw", data: body });
          }
        });
      });
      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Playit API request timed out"));
      });
      req.write(payload);
      req.end();
    });
  }
  /**
   * Retrieves the secret key from workspace playit.toml or %LOCALAPPDATA%/playit_gg/playit.toml.
   */
  static getSecretKey() {
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    const workspaceToml = path.join(binDir, "playit.toml");
    if (fs.existsSync(workspaceToml)) {
      const content = fs.readFileSync(workspaceToml, "utf8");
      const match = content.match(/(?:secret_key|secret)\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        return { secretKey: match[1], configPath: workspaceToml };
      }
    }
    const found = this.findSecretInKnownPaths();
    if (found) {
      try {
        fs.writeFileSync(workspaceToml, found.content, "utf8");
      } catch {
      }
      return { secretKey: found.secret, configPath: workspaceToml };
    }
    return { secretKey: null, configPath: workspaceToml };
  }
  /**
   * THE CORRECT CLAIM FLOW:
   * 1. Spawn playit.exe with NO arguments — it auto-generates a claim URL in its stderr
   * 2. Parse that URL from the output and open it in the browser
   * 3. Watch %LOCALAPPDATA%/playit_gg/playit.toml for the secret key that playit.exe writes automatically
   * 4. Once secret found, kill the unclaimed process, copy secret to workspace, restart with --secret-path
   */
  static async startClaimFlow(port = 25565) {
    await this.stopTunnel();
    this.updateStatus({
      isActive: true,
      status: "STARTING",
      claimUrl: null,
      serverAddress: null,
      port,
      error: null
    });
    const binPath = this.getBinaryPath();
    if (!fs.existsSync(binPath)) {
      this.updateStatus({ isActive: false, status: "ERROR", error: "PlayIt.gg binary not found. Please re-run setup." });
      return this.currentStatus;
    }
    const workspaceToml = path.join(AppPaths.getBinDir(), "playit.toml");
    try {
      if (fs.existsSync(workspaceToml)) fs.unlinkSync(workspaceToml);
    } catch {
    }
    const existingSecret = this.findSecretInKnownPaths();
    if (existingSecret) {
      logger$4.info(`Found existing PlayIt secret at ${existingSecret.path}. Skipping claim flow and auto-starting tunnel.`);
      try {
        fs.writeFileSync(workspaceToml, existingSecret.content, "utf8");
      } catch {
      }
      setTimeout(() => this.startTunnel(port), 500);
      return this.currentStatus;
    }
    logger$4.info("Spawning playit.exe with no arguments to generate claim URL...");
    const child = child_process.spawn(binPath, [], {
      cwd: AppPaths.getBinDir(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    this.childProcess = child;
    let claimUrlFound = false;
    const handleOutput = (data) => {
      const text = data.toString("utf-8");
      logger$4.info(`[PlayitClaim] ${text.trim()}`);
      if (!claimUrlFound) {
        const claimMatch = text.match(/https:\/\/playit\.gg\/claim\/([a-z0-9]+)/i);
        if (claimMatch) {
          claimUrlFound = true;
          const claimUrl = claimMatch[0];
          logger$4.info(`Claim URL detected from playit.exe output: ${claimUrl}`);
          this.updateStatus({
            status: "WAITING_CLAIM",
            claimUrl
          });
          try {
            electron.shell.openExternal(claimUrl);
          } catch (err) {
            logger$4.warn("Failed to auto-open claim URL in browser", err);
          }
          this.startSecretWatcher(port, child);
        }
      }
      const addressMatch = text.match(/([a-zA-Z0-9_\-]+\.craft\.ply\.gg(?::\d+)?)/i) || text.match(/([a-zA-Z0-9_\-]+\.tun\.ply\.gg(?::\d+)?)/i) || text.match(/([a-zA-Z0-9_\-]+\.ply\.gg:\d+)/i) || text.match(/([a-zA-Z0-9_\-]+\.playit\.gg:\d+)/i);
      if (addressMatch && addressMatch[1]) {
        const cleanAddress = addressMatch[1].trim().replace(/^tcp:\/\//i, "");
        if (!cleanAddress.includes("localhost") && !cleanAddress.includes("127.0.0.1")) {
          logger$4.info(`PlayIt.gg Tunnel Active (from output): ${cleanAddress}`);
          this.updateStatus({
            status: "ONLINE",
            serverAddress: cleanAddress,
            claimUrl: null,
            error: null
          });
          if (this.claimWatchInterval) {
            clearInterval(this.claimWatchInterval);
            this.claimWatchInterval = null;
          }
        }
      }
    };
    child.stdout.on("data", handleOutput);
    child.stderr.on("data", handleOutput);
    child.on("error", (err) => {
      logger$4.error("PlayIt.gg claim process error", err);
      this.updateStatus({ isActive: false, status: "ERROR", error: err.message });
    });
    child.on("close", (code) => {
      logger$4.info(`PlayIt.gg claim process closed with code ${code}`);
      this.childProcess = null;
      if (this.currentStatus.status === "WAITING_CLAIM") {
        logger$4.info("Process exited during WAITING_CLAIM — searching for secret file written by agent...");
        const found = this.findSecretInKnownPaths();
        if (found) {
          logger$4.info(`Secret found at: ${found.path} — restarting tunnel with secret.`);
          if (this.claimWatchInterval) {
            clearInterval(this.claimWatchInterval);
            this.claimWatchInterval = null;
          }
          const workspaceToml2 = path.join(AppPaths.getBinDir(), "playit.toml");
          try {
            fs.writeFileSync(workspaceToml2, found.content, "utf8");
          } catch {
          }
          setTimeout(() => this.startTunnel(port), 800);
        } else {
          logger$4.info("No secret found on exit — continuing to watch for config file...");
        }
      }
    });
    return this.currentStatus;
  }
  /**
   * Searches all known config file locations for a valid PlayIt.gg secret.
   * Returns the content and path of the first found secret file, or null.
   */
  static findSecretInKnownPaths() {
    const appData = process.env.APPDATA || "";
    const localAppData = process.env.LOCALAPPDATA || "";
    const userProfile = process.env.USERPROFILE || "";
    const binDir = AppPaths.getBinDir();
    const workspaceToml = path.join(binDir, "playit.toml");
    const candidates = [
      path.join(binDir, "config.toml"),
      path.join(appData, "playit", "config.toml"),
      path.join(appData, "playit_gg", "config.toml"),
      path.join(appData, "playit_gg", "playit.toml"),
      path.join(localAppData, "playit_gg", "playit.toml"),
      path.join(localAppData, "playit", "config.toml"),
      path.join(userProfile, ".config", "playit", "config.toml"),
      path.join(userProfile, ".playit", "config.toml")
    ];
    try {
      const files = fs.readdirSync(binDir).filter((f) => f.endsWith(".toml"));
      for (const f of files) {
        const p = path.join(binDir, f);
        if (p !== workspaceToml && !candidates.includes(p)) {
          candidates.unshift(p);
        }
      }
    } catch {
    }
    for (const candidate of candidates) {
      if (candidate === workspaceToml) continue;
      try {
        if (!fs.existsSync(candidate)) continue;
        const content = fs.readFileSync(candidate, "utf8");
        const match = content.match(/(?:secret_key|secret)\s*=\s*"([^"]+)"/);
        if (match && match[1] && match[1].length > 10) {
          logger$4.info(`Found secret in: ${candidate}`);
          return { path: candidate, content, secret: match[1] };
        }
      } catch {
      }
    }
    return null;
  }
  /**
   * Watches for the secret key file that playit.exe auto-writes after a successful browser claim.
   * Checks all known config file locations every 2 seconds.
   * When found: copies to workspace, kills unclaimed process, restarts with secret.
   */
  static startSecretWatcher(port, claimProcess) {
    if (this.claimWatchInterval) {
      clearInterval(this.claimWatchInterval);
      this.claimWatchInterval = null;
    }
    const workspaceToml = path.join(AppPaths.getBinDir(), "playit.toml");
    logger$4.info("Secret watcher started — polling all known PlayIt.gg config locations...");
    this.claimWatchInterval = setInterval(async () => {
      try {
        const found = this.findSecretInKnownPaths();
        if (!found) return;
        logger$4.info("Secret key obtained from playit.gg claim! Transitioning to tunnel mode...");
        if (this.claimWatchInterval) {
          clearInterval(this.claimWatchInterval);
          this.claimWatchInterval = null;
        }
        try {
          fs.writeFileSync(workspaceToml, found.content, "utf8");
        } catch {
        }
        logger$4.info("PlayIt agent successfully claimed. Starting API polling...");
        this.updateStatus({
          isActive: true,
          status: "ONLINE",
          serverAddress: null,
          claimUrl: null,
          error: null
        });
        this.startApiPolling(found.secret, port);
      } catch (e) {
        logger$4.warn("Error in secret watcher", e);
      }
    }, 2e3);
  }
  /**
   * Queries playit.gg API for active public tunnel addresses.
   */
  static async queryPublicAddress(secretKey, port) {
    var _a, _b, _c, _d, _e, _f;
    try {
      let address = null;
      let bedrockAddress = null;
      const listRes = await this.apiRequest("/tunnels/list", {}, secretKey);
      if (listRes && listRes.status === "success" && Array.isArray((_a = listRes.data) == null ? void 0 : _a.tunnels)) {
        for (const tunnel of listRes.data.tunnels) {
          const alloc = (_b = tunnel.alloc) == null ? void 0 : _b.data;
          if (!alloc) continue;
          const tunnelAddr = alloc.assigned_domain ? `${alloc.assigned_domain}:${alloc.port_start}` : null;
          if (tunnel.tunnel_type === "minecraft-bedrock" || tunnel.port_type === "udp" || ((_d = (_c = tunnel.origin) == null ? void 0 : _c.data) == null ? void 0 : _d.local_port) === 19132) {
            bedrockAddress = tunnelAddr;
          } else if (tunnel.tunnel_type === "minecraft-java" || tunnel.port_type === "tcp" || ((_f = (_e = tunnel.origin) == null ? void 0 : _e.data) == null ? void 0 : _f.local_port) === 25565) {
            address = tunnelAddr;
          }
        }
        if (address || bedrockAddress) {
          return { isConnected: true, address, bedrockAddress };
        }
      }
      const runRes = await this.apiRequest("/agents/rundata", {}, secretKey);
      if (runRes && runRes.status === "success") {
        const rawJson = JSON.stringify(runRes);
        const addressMatch = rawJson.match(/([a-zA-Z0-9_\-]+\.craft\.ply\.gg(?::\d+)?)/i) || rawJson.match(/([a-zA-Z0-9_\-]+\.tun\.ply\.gg(?::\d+)?)/i) || rawJson.match(/([a-zA-Z0-9_\-]+\.ply\.gg:\d+)/i) || rawJson.match(/([a-zA-Z0-9_\-]+\.playit\.gg:\d+)/i);
        if (addressMatch && addressMatch[1]) {
          let cleanAddress = addressMatch[1].trim().replace(/^tcp:\/\//i, "");
          if (!cleanAddress.includes("localhost") && !cleanAddress.includes("127.0.0.1")) {
            if (!cleanAddress.includes(":")) {
              const portMatch = rawJson.match(/"port_start":(\d+)/) || rawJson.match(/"port":(\d+)/);
              if (portMatch && portMatch[1]) {
                cleanAddress = `${cleanAddress}:${portMatch[1]}`;
              }
            }
            address = cleanAddress;
            return { isConnected: true, address, bedrockAddress };
          }
        }
      }
      if (listRes && listRes.status === "success") {
        return { isConnected: true, address: null, bedrockAddress: null };
      }
    } catch (e) {
      logger$4.warn("Failed to query public tunnel address from API", e);
    }
    return { isConnected: false, address: null, bedrockAddress: null };
  }
  /**
   * Starts continuous polling for the public tunnel address.
   */
  static startApiPolling(secretKey, port) {
    if (this.tunnelQueryInterval) clearInterval(this.tunnelQueryInterval);
    const checkAddress = async () => {
      const result = await this.queryPublicAddress(secretKey, port);
      if (result.isConnected) {
        logger$4.info(`PlayIt.gg Agent authenticated. Address: ${result.address || "none yet"}, Bedrock: ${result.bedrockAddress || "none yet"}`);
        this.updateStatus({
          status: "ONLINE",
          serverAddress: result.address,
          bedrockAddress: result.bedrockAddress,
          claimUrl: null,
          error: null
        });
        if ((result.address || result.bedrockAddress) && this.tunnelQueryInterval) {
          clearInterval(this.tunnelQueryInterval);
          this.tunnelQueryInterval = null;
        }
      }
    };
    checkAddress();
    this.tunnelQueryInterval = setInterval(async () => {
      if (this.currentStatus.serverAddress || !this.childProcess) {
        if (this.tunnelQueryInterval) {
          clearInterval(this.tunnelQueryInterval);
          this.tunnelQueryInterval = null;
        }
        return;
      }
      await checkAddress();
    }, 3e3);
  }
  /**
   * Starts the embedded PlayIt.gg tunnel process for the Minecraft server port.
   * If no secret key found, launches the full claim flow.
   */
  static async startTunnel(port = 25565) {
    if (this.childProcess) {
      if (this.currentStatus.isActive && this.currentStatus.status === "ONLINE") {
        return this.currentStatus;
      }
      await this.stopTunnel();
    }
    this.updateStatus({
      isActive: true,
      status: "STARTING",
      port,
      claimUrl: null,
      serverAddress: null,
      error: null
    });
    try {
      const isReady = await this.ensureBinary();
      if (!isReady) {
        throw new Error("Failed to download PlayIt.gg Agent executable.");
      }
      const { secretKey, configPath } = this.getSecretKey();
      if (!secretKey) {
        return await this.startClaimFlow(port);
      }
      const binPath = this.getBinaryPath();
      const workingDir = AppPaths.getBinDir();
      logger$4.info(`Starting PlayIt.gg process with secret: ${binPath}`);
      const child = child_process.spawn(binPath, ["--secret_path", configPath, "--stdout", "start"], {
        cwd: workingDir,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      this.childProcess = child;
      const handleOutput = async (data) => {
        const text = data.toString("utf-8");
        logger$4.info(`[PlayitAgent] ${text.trim()}`);
        if (text.includes("Invalid secret")) {
          logger$4.warn("PlayIt Agent detected an invalid secret! Auto-resetting and returning to claim flow...");
          if (this.tunnelQueryInterval) {
            clearInterval(this.tunnelQueryInterval);
            this.tunnelQueryInterval = null;
          }
          const workspaceToml = path.join(workingDir, "playit.toml");
          try {
            if (fs.existsSync(workspaceToml)) fs.unlinkSync(workspaceToml);
          } catch {
          }
          const sysSecret = this.findSecretInKnownPaths();
          if (sysSecret) {
            try {
              if (fs.existsSync(sysSecret.path)) fs.unlinkSync(sysSecret.path);
            } catch {
            }
          }
          try {
            if (process.platform === "win32" && child.pid) {
              child_process.spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"]);
            } else {
              child.kill("SIGINT");
            }
          } catch {
          }
          this.childProcess = null;
          setTimeout(() => this.startClaimFlow(port), 500);
          return;
        }
        const addressMatch = text.match(/([a-zA-Z0-9_\-]+\.craft\.ply\.gg(?::\d+)?)/i) || text.match(/([a-zA-Z0-9_\-]+\.tun\.ply\.gg(?::\d+)?)/i) || text.match(/([a-zA-Z0-9_\-]+\.ply\.gg:\d+)/i) || text.match(/([a-zA-Z0-9_\-]+\.playit\.gg:\d+)/i) || text.match(/tunnel:\s*([^\s\r\n]+)/i);
        if (addressMatch && addressMatch[1]) {
          const cleanAddress = addressMatch[1].trim().replace(/^tcp:\/\//i, "");
          if (!cleanAddress.includes("localhost") && !cleanAddress.includes("127.0.0.1")) {
            logger$4.info(`PlayIt.gg Tunnel Online: ${cleanAddress}`);
            this.updateStatus({
              status: "ONLINE",
              serverAddress: cleanAddress,
              claimUrl: null,
              error: null
            });
          }
        }
      };
      child.stdout.on("data", handleOutput);
      child.stderr.on("data", handleOutput);
      child.on("error", (err) => {
        logger$4.error("PlayIt.gg process encountered an error", err);
        this.updateStatus({
          isActive: false,
          status: "ERROR",
          error: err.message || "Failed to start PlayIt.gg process."
        });
      });
      child.on("close", (code) => {
        logger$4.info(`PlayIt.gg process exited with code ${code}`);
        this.childProcess = null;
        if (this.currentStatus.isActive && this.currentStatus.status !== "ERROR") {
          if (this.isRestartingForClaim) {
            this.isRestartingForClaim = false;
          } else {
            this.updateStatus({
              isActive: false,
              status: "STOPPED",
              serverAddress: null,
              claimUrl: null
            });
          }
        }
      });
      this.startApiPolling(secretKey, port);
      return this.currentStatus;
    } catch (err) {
      logger$4.error("Failed to start PlayIt.gg tunnel", err);
      this.updateStatus({
        isActive: false,
        status: "ERROR",
        error: err.message || "Failed to launch PlayIt.gg engine."
      });
      return this.currentStatus;
    }
  }
  /**
   * Stops the active PlayIt.gg tunnel process.
   */
  static async stopTunnel() {
    if (this.claimWatchInterval) {
      clearInterval(this.claimWatchInterval);
      this.claimWatchInterval = null;
    }
    if (this.tunnelQueryInterval) {
      clearInterval(this.tunnelQueryInterval);
      this.tunnelQueryInterval = null;
    }
    if (this.childProcess) {
      logger$4.info("Stopping PlayIt.gg background process...");
      try {
        if (process.platform === "win32" && this.childProcess.pid) {
          child_process.spawn("taskkill", ["/pid", this.childProcess.pid.toString(), "/f", "/t"]);
        } else {
          this.childProcess.kill("SIGINT");
        }
      } catch (e) {
        logger$4.warn("Failed to kill PlayIt.gg process cleanly", e);
      }
      this.childProcess = null;
    }
    this.updateStatus({
      isActive: false,
      status: "STOPPED",
      serverAddress: null,
      claimUrl: null,
      error: null
    });
    return this.currentStatus;
  }
  /**
   * Returns current Cloud Relay status.
   */
  static getStatus() {
    return { ...this.currentStatus };
  }
}
__publicField(PlayitService, "childProcess", null);
__publicField(PlayitService, "claimWatchInterval", null);
__publicField(PlayitService, "tunnelQueryInterval", null);
__publicField(PlayitService, "currentStatus", {
  isActive: false,
  status: "STOPPED",
  claimUrl: null,
  serverAddress: null,
  bedrockAddress: null,
  port: 25565,
  error: null
});
__publicField(PlayitService, "onStatusChangeListeners", []);
__publicField(PlayitService, "isRestartingForClaim", false);
const logger$3 = new Logger("LanBroadcast");
class LanBroadcastService {
  /**
   * Starts broadcasting Minecraft LAN discovery packets.
   */
  static startBroadcasting(motd = "Craftora LAN Server", port = 25565) {
    if (this.isRunning) return;
    try {
      this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
      this.socket.bind(() => {
        if (!this.socket) return;
        this.socket.setBroadcast(true);
        this.socket.setMulticastTTL(4);
        const packetMessage = `[MOTD]${motd}[/MOTD][AD]${port}[/AD]`;
        const buffer = Buffer.from(packetMessage, "utf-8");
        this.isRunning = true;
        logger$3.info(`LAN discovery broadcaster started on ${this.MULTICAST_ADDRESS}:${this.MULTICAST_PORT}`);
        this.intervalTimer = setInterval(() => {
          if (!this.socket || !this.isRunning) return;
          this.socket.send(buffer, 0, buffer.length, this.MULTICAST_PORT, this.MULTICAST_ADDRESS, (err) => {
            if (err) {
              logger$3.debug("Error sending LAN packet", err);
            }
          });
        }, 1500);
      });
      this.socket.on("error", (err) => {
        logger$3.warn("LAN Broadcast socket error", err);
      });
    } catch (e) {
      logger$3.error("Failed to start LAN broadcaster", e);
    }
  }
  /**
   * Stops LAN broadcasting.
   */
  static stopBroadcasting() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
      }
      this.socket = null;
    }
    this.isRunning = false;
    logger$3.info("LAN discovery broadcaster stopped");
  }
  static getIsRunning() {
    return this.isRunning;
  }
}
__publicField(LanBroadcastService, "socket", null);
__publicField(LanBroadcastService, "intervalTimer", null);
__publicField(LanBroadcastService, "isRunning", false);
__publicField(LanBroadcastService, "MULTICAST_ADDRESS", "224.0.2.60");
__publicField(LanBroadcastService, "MULTICAST_PORT", 4445);
class NetworkTesterService {
  /**
   * Retrieves local network IPv4 address.
   */
  static getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (!netInterface) continue;
      for (const iface of netInterface) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
    return "127.0.0.1";
  }
  /**
   * Resolves public external IP.
   */
  static async getPublicIp() {
    const endpoints = [
      "https://api.ipify.org?format=json",
      "https://api4.my-ip.io/v2/ip.json"
    ];
    for (const url2 of endpoints) {
      try {
        const ip = await new Promise((resolve, reject) => {
          https.get(url2, { timeout: 3500 }, (res) => {
            if (res.statusCode !== 200) return reject();
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed.ip || parsed.data || null);
              } catch {
                reject();
              }
            });
          }).on("error", reject);
        });
        if (ip) return ip;
      } catch {
      }
    }
    return null;
  }
  /**
   * Tests whether a TCP port is open and listening locally.
   */
  static async checkPortListening(port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1500);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("error", () => {
        resolve(false);
      });
      socket.connect(port, "127.0.0.1");
    });
  }
  /**
   * Complete network diagnostics summary.
   */
  static async getDiagnostics() {
    const localIp = this.getLocalIp();
    const publicIp = await this.getPublicIp();
    return {
      localIp,
      publicIp,
      gatewayIp: null,
      isOnline: publicIp !== null
    };
  }
}
function registerNetworkIpc(mainWindow2) {
  if (mainWindow2) {
    PlayitService.onStatusChange((status) => {
      try {
        if (!mainWindow2.isDestroyed()) {
          mainWindow2.webContents.send("cloud-tunnel:status-update", status);
        }
      } catch {
      }
    });
  }
  electron.ipcMain.handle("upnp:check-support", async (_, forceRefresh) => {
    return await UpnpService.checkSupport(Boolean(forceRefresh));
  });
  electron.ipcMain.handle("upnp:start", async (_, { port = 25565, protocol = "TCP", description }) => {
    return await UpnpService.openPort(port, protocol, description);
  });
  electron.ipcMain.handle("upnp:stop", async (_, { port = 25565, protocol = "TCP" } = {}) => {
    return await UpnpService.closePort(port, protocol);
  });
  electron.ipcMain.handle("upnp:get-status", () => {
    return UpnpService.getStatus();
  });
  electron.ipcMain.handle("cloud-tunnel:start", async (_, { port = 25565 } = {}) => {
    return await PlayitService.startTunnel(port);
  });
  electron.ipcMain.handle("cloud-tunnel:stop", async () => {
    return await PlayitService.stopTunnel();
  });
  electron.ipcMain.handle("cloud-tunnel:get-status", () => {
    return PlayitService.getStatus();
  });
  electron.ipcMain.handle("cloud-tunnel:ensure-binary", async () => {
    return await PlayitService.ensureBinary();
  });
  electron.ipcMain.handle("lan:start", (_, { motd, port }) => {
    LanBroadcastService.startBroadcasting(motd, port);
    return true;
  });
  electron.ipcMain.handle("lan:stop", () => {
    LanBroadcastService.stopBroadcasting();
    return true;
  });
  electron.ipcMain.handle("lan:get-status", () => {
    return LanBroadcastService.getIsRunning();
  });
  electron.ipcMain.handle("network:get-diagnostics", async () => {
    return await NetworkTesterService.getDiagnostics();
  });
  electron.ipcMain.handle("network:check-port", async (_, port) => {
    return await NetworkTesterService.checkPortListening(port);
  });
}
const logger$2 = new Logger("GeyserService");
class GeyserService {
  /**
   * Checks if GeyserMC is installed in the server plugins directory.
   */
  static isGeyserInstalled(serverDir) {
    const pluginsDir = path.join(serverDir, "plugins");
    if (!fs.existsSync(pluginsDir)) return false;
    const files = fs.readdirSync(pluginsDir);
    return files.some((f) => f.toLowerCase().includes("geyser") && f.endsWith(".jar"));
  }
  /**
   * Checks if Floodgate is installed in the server plugins directory.
   */
  static isFloodgateInstalled(serverDir) {
    const pluginsDir = path.join(serverDir, "plugins");
    if (!fs.existsSync(pluginsDir)) return false;
    const files = fs.readdirSync(pluginsDir);
    return files.some((f) => f.toLowerCase().includes("floodgate") && f.endsWith(".jar"));
  }
  /**
   * 1-Click install of both GeyserMC & Floodgate plugins for seamless Java + Bedrock cross-play.
   */
  static async installGeyserAndFloodgate(serverDir, onProgress) {
    const pluginsDir = path.join(serverDir, "plugins");
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }
    const geyserDest = path.join(pluginsDir, "Geyser-Spigot.jar");
    const floodgateDest = path.join(pluginsDir, "floodgate-spigot.jar");
    logger$2.info("Downloading GeyserMC Spigot plugin...");
    await JarDownloaderService.downloadFile(this.GEYSER_SPIGOT_URL, geyserDest, (percent) => {
      if (onProgress) onProgress("GeyserMC", percent);
    });
    logger$2.info("Downloading Floodgate Spigot plugin...");
    await JarDownloaderService.downloadFile(this.FLOODGATE_SPIGOT_URL, floodgateDest, (percent) => {
      if (onProgress) onProgress("Floodgate", percent);
    });
    this.ensureGeyserConfig(serverDir, {
      bedrockPort: 19132,
      bedrockAddress: "0.0.0.0",
      cloneRemotePort: true,
      authType: "floodgate",
      motd1: "Craftora Cross-Play Server",
      motd2: "Java & Bedrock Supported!",
      passthroughMotd: true,
      passthroughMaxPlayers: true
    });
    logger$2.info("GeyserMC & Floodgate cross-play setup complete!");
  }
  /**
   * Reads GeyserMC configuration if present.
   */
  static getGeyserConfig(serverDir) {
    const configPath = path.join(serverDir, "plugins", "Geyser-Spigot", "config.yml");
    const defaultConfig = {
      bedrockPort: 19132,
      bedrockAddress: "0.0.0.0",
      cloneRemotePort: true,
      authType: "floodgate",
      motd1: "Craftora Server",
      motd2: "Cross-Play Active",
      passthroughMotd: true,
      passthroughMaxPlayers: true
    };
    if (!fs.existsSync(configPath)) return defaultConfig;
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const portMatch = content.match(/port:\s*(\d+)/);
      const authMatch = content.match(/auth-type:\s*(\w+)/);
      const motd1Match = content.match(/motd1:\s*["']?([^"'\n\r]+)["']?/);
      const motd2Match = content.match(/motd2:\s*["']?([^"'\n\r]+)["']?/);
      const cloneRemotePort = content.includes("clone-remote-port: true");
      return {
        bedrockPort: portMatch ? parseInt(portMatch[1], 10) : 19132,
        bedrockAddress: "0.0.0.0",
        cloneRemotePort,
        authType: authMatch ? authMatch[1] : "floodgate",
        motd1: motd1Match ? motd1Match[1] : defaultConfig.motd1,
        motd2: motd2Match ? motd2Match[1] : defaultConfig.motd2,
        passthroughMotd: content.includes("passthrough-motd: true"),
        passthroughMaxPlayers: content.includes("passthrough-max-players: true")
      };
    } catch (e) {
      logger$2.error("Failed to read Geyser config.yml", e);
      return defaultConfig;
    }
  }
  /**
   * Generates or updates GeyserMC configuration to ensure Bedrock port 19132 and Floodgate authentication.
   */
  static ensureGeyserConfig(serverDir, config) {
    const geyserFolder = path.join(serverDir, "plugins", "Geyser-Spigot");
    if (!fs.existsSync(geyserFolder)) {
      fs.mkdirSync(geyserFolder, { recursive: true });
    }
    const configPath = path.join(geyserFolder, "config.yml");
    const yamlContent = `# GeyserMC Configuration - Managed by Craftora
bedrock:
  address: 0.0.0.0
  port: ${config.bedrockPort}
  clone-remote-port: ${config.cloneRemotePort}
  motd1: "${config.motd1}"
  motd2: "${config.motd2}"
  server-name: "Craftora"
  enable-proxy-connections: false

remote:
  address: 127.0.0.1
  port: 25565
  auth-type: ${config.authType}
  use-proxy-protocol: false

passthrough-motd: ${config.passthroughMotd}
passthrough-protocol-name: true
passthrough-player-counts: true
passthrough-max-players: ${config.passthroughMaxPlayers}
legacy-ping-passthrough: false
ping-passthrough-interval: 3
forward-hostname: true

max-players: 100
debug-mode: false
allow-third-party-capes: true
show-cooldown: title
show-coordinates: true
disable-custom-skins: false
`;
    fs.writeFileSync(configPath, yamlContent, "utf-8");
    logger$2.info(`Geyser configuration written to: ${configPath}`);
  }
  /**
   * Removes Geyser & Floodgate plugins.
   */
  static removeGeyser(serverDir) {
    const pluginsDir = path.join(serverDir, "plugins");
    if (!fs.existsSync(pluginsDir)) return;
    const files = fs.readdirSync(pluginsDir);
    for (const file of files) {
      if ((file.toLowerCase().includes("geyser") || file.toLowerCase().includes("floodgate")) && file.endsWith(".jar")) {
        fs.unlinkSync(path.join(pluginsDir, file));
      }
    }
    logger$2.info("GeyserMC and Floodgate plugins removed");
  }
}
__publicField(GeyserService, "GEYSER_SPIGOT_URL", "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot");
__publicField(GeyserService, "FLOODGATE_SPIGOT_URL", "https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot");
const logger$1 = new Logger("PluginManager");
class PluginManagerService {
  static getPopularCatalog() {
    return this.POPULAR_PLUGINS;
  }
  /**
   * Lists all plugins installed in the server's plugins directory.
   */
  static getInstalledPlugins(serverDir) {
    const pluginsDir = path.join(serverDir, "plugins");
    if (!fs.existsSync(pluginsDir)) {
      return [];
    }
    try {
      const files = fs.readdirSync(pluginsDir);
      const list = [];
      for (const file of files) {
        if (file.endsWith(".jar") || file.endsWith(".jar.disabled")) {
          const fullPath = path.join(pluginsDir, file);
          const stats = fs.statSync(fullPath);
          const isEnabled = file.endsWith(".jar");
          const cleanName = file.replace(/\.jar(\.disabled)?$/, "");
          list.push({
            name: cleanName,
            filename: file,
            size: stats.size,
            enabled: isEnabled,
            isCustom: true
          });
        }
      }
      return list;
    } catch (e) {
      logger$1.error("Failed to list plugins", e);
      return [];
    }
  }
  /**
   * Dynamically resolves the latest direct jar download URL from Modrinth CDN with fallback.
   */
  static async resolvePluginUrl(pluginId) {
    const popular = this.POPULAR_PLUGINS.find((p) => p.id === pluginId);
    if (!popular) throw new Error(`Plugin ${pluginId} not found`);
    const modrinthSlugs = {
      viaversion: "viaversion",
      viabackwards: "viabackwards",
      essentialsx: "essentialsx",
      chunky: "chunky",
      skinsrestorer: "skinsrestorer",
      coreprotect: "coreprotect",
      onlysleep: "onlysleep"
    };
    if (modrinthSlugs[pluginId]) {
      try {
        const slug = modrinthSlugs[pluginId];
        const versions = await JarDownloaderService.fetchJson(
          `https://api.modrinth.com/v2/project/${slug}/version`
        );
        if (versions && versions.length > 0) {
          for (const ver of versions) {
            if (ver.files && ver.files.length > 0) {
              const jarFile = ver.files.find((f) => f.filename.endsWith(".jar") && !f.filename.includes("sources"));
              if (jarFile == null ? void 0 : jarFile.url) {
                logger$1.info(`Resolved latest ${popular.name} from Modrinth CDN: ${jarFile.filename}`);
                return jarFile.url;
              }
            }
          }
        }
      } catch (modrinthErr) {
        logger$1.warn(`Modrinth API lookup for ${pluginId} failed, falling back to static URL`, modrinthErr);
      }
    }
    return popular.downloadUrl;
  }
  /**
   * Installs a popular plugin directly from curated catalog or direct URL.
   */
  static async installPlugin(serverDir, pluginId, onProgress) {
    const popular = this.POPULAR_PLUGINS.find((p) => p.id === pluginId);
    if (!popular) {
      throw new Error(`Plugin ${pluginId} not found in catalog.`);
    }
    const pluginsDir = path.join(serverDir, "plugins");
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }
    const destFile = path.join(pluginsDir, `${popular.name}.jar`);
    try {
      const cacheDir = AppPaths.getPluginsCacheDir();
      const cachedCandidates = [
        path.join(cacheDir, `${popular.name}.jar`),
        path.join(cacheDir, `${popular.id}.jar`),
        path.join(cacheDir, "SkinsRestorer.jar"),
        path.join(cacheDir, "Geyser-Spigot.jar"),
        path.join(cacheDir, "Floodgate-Spigot.jar")
      ];
      for (const candidate of cachedCandidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).size > 1e3) {
          const candidateBase = path.basename(candidate).toLowerCase();
          const targetBase = popular.name.toLowerCase();
          if (candidateBase.includes(targetBase) || targetBase.includes(candidateBase.replace(".jar", ""))) {
            fs.copyFileSync(candidate, destFile);
            logger$1.info(`Installed plugin ${popular.name} from local workspace cache.`);
            if (onProgress) onProgress(100);
            return destFile;
          }
        }
      }
    } catch (e) {
      logger$1.warn("Failed to check plugin cache", e);
    }
    let downloadUrl = popular.downloadUrl;
    try {
      downloadUrl = await this.resolvePluginUrl(pluginId);
    } catch {
      downloadUrl = popular.downloadUrl;
    }
    logger$1.info(`Installing plugin ${popular.name} from ${downloadUrl} to ${destFile}...`);
    try {
      await JarDownloaderService.downloadFile(downloadUrl, destFile, onProgress);
      logger$1.info(`Plugin ${popular.name} installed successfully!`);
      return destFile;
    } catch (err) {
      if (downloadUrl !== popular.downloadUrl) {
        logger$1.warn(`Retrying ${popular.name} with static fallback URL: ${popular.downloadUrl}`);
        await JarDownloaderService.downloadFile(popular.downloadUrl, destFile, onProgress);
        return destFile;
      }
      logger$1.error(`Failed to download plugin ${popular.name}`, err);
      throw err;
    }
  }
  /**
   * Automatically ensures SkinsRestorer is installed if cracked mode is activated.
   */
  static async ensureSkinsRestorer(serverDir) {
    const plugins = this.getInstalledPlugins(serverDir);
    const hasSkins = plugins.some((p) => p.name.toLowerCase().includes("skinsrestorer"));
    if (!hasSkins) {
      logger$1.info("Auto-installing SkinsRestorer for cracked server support...");
      try {
        await this.installPlugin(serverDir, "skinsrestorer");
      } catch (e) {
        logger$1.warn("Could not auto-download SkinsRestorer", e);
      }
    }
  }
  /**
   * Toggles a plugin enabled/disabled by renaming the jar extension.
   */
  static togglePlugin(serverDir, filename) {
    const pluginsDir = path.join(serverDir, "plugins");
    const oldPath = path.join(pluginsDir, filename);
    if (!fs.existsSync(oldPath)) return false;
    let newPath = "";
    if (filename.endsWith(".disabled")) {
      newPath = path.join(pluginsDir, filename.replace(".disabled", ""));
    } else {
      newPath = path.join(pluginsDir, `${filename}.disabled`);
    }
    fs.renameSync(oldPath, newPath);
    return true;
  }
  /**
   * Deletes a plugin jar file.
   */
  static deletePlugin(serverDir, filename) {
    const pluginsDir = path.join(serverDir, "plugins");
    const target = path.join(pluginsDir, filename);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      return true;
    }
    return false;
  }
}
// Curated popular and essential plugins
__publicField(PluginManagerService, "POPULAR_PLUGINS", [
  {
    id: "skinsrestorer",
    name: "SkinsRestorer",
    description: "Restores player skins for cracked (offline-mode) servers & allows custom /skin commands.",
    category: "Cosmetic / Cracked",
    downloadUrl: "https://github.com/SkinsRestorer/SkinsRestorerX/releases/latest/download/SkinsRestorer.jar",
    icon: "UserCheck",
    recommendedForCracked: true
  },
  {
    id: "geyser",
    name: "Geyser-Spigot",
    description: "Enables Bedrock (mobile, console, Windows) players to join Java servers seamlessly.",
    category: "Cross-Play",
    downloadUrl: "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot",
    icon: "Smartphone"
  },
  {
    id: "viaversion",
    name: "ViaVersion",
    description: "Allows newer Minecraft client versions to connect to older server versions.",
    category: "Compatibility",
    downloadUrl: "https://github.com/ViaVersion/ViaVersion/releases/latest/download/ViaVersion.jar",
    icon: "Layers"
  },
  {
    id: "viabackwards",
    name: "ViaBackwards",
    description: "Allows older Minecraft client versions to connect to newer server versions.",
    category: "Compatibility",
    downloadUrl: "https://github.com/ViaVersion/ViaBackwards/releases/latest/download/ViaBackwards.jar",
    icon: "History"
  },
  {
    id: "luckperms",
    name: "LuckPerms",
    description: "Industry-standard permissions management system with web editor.",
    category: "Administration",
    downloadUrl: "https://download.luckperms.net/1559/bukkit/loader/LuckPerms-Bukkit-5.4.145.jar",
    icon: "Shield"
  },
  {
    id: "essentialsx",
    name: "EssentialsX",
    description: "Provides over 100 essential commands, economy, spawn, teleports, and kits.",
    category: "Core Gameplay",
    downloadUrl: "https://github.com/EssentialsX/Essentials/releases/latest/download/EssentialsX.jar",
    icon: "Wrench"
  },
  {
    id: "chunky",
    name: "Chunky",
    description: "Pre-generates world chunks in advance to eliminate chunk-loading lag spikes during gameplay.",
    category: "Performance",
    downloadUrl: "https://hangarcdn.papermc.io/plugins/pop4959/Chunky/versions/1.4.28/PAPER/Chunky-1.4.28.jar",
    icon: "Zap"
  },
  {
    id: "coreprotect",
    name: "CoreProtect",
    description: "Fast, efficient data logging and anti-grief rollback tool.",
    category: "Security",
    downloadUrl: "https://mediafilez.forgecdn.net/files/5465/321/CoreProtect-22.4.jar",
    icon: "Lock"
  },
  {
    id: "onlysleep",
    name: "OnlySleep",
    description: "Modern 1-player sleep plugin with bossbars, percentages, and custom messages.",
    category: "Core Gameplay",
    downloadUrl: "https://github.com/onlysleep",
    // Will be resolved dynamically
    icon: "Moon"
  }
]);
function registerPluginsIpc() {
  electron.ipcMain.handle("geyser:is-installed", (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return GeyserService.isGeyserInstalled(serverDir);
  });
  electron.ipcMain.handle("geyser:install", async (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    await GeyserService.installGeyserAndFloodgate(serverDir);
    return true;
  });
  electron.ipcMain.handle("geyser:remove", (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    GeyserService.removeGeyser(serverDir);
    return true;
  });
  electron.ipcMain.handle("geyser:get-config", (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return GeyserService.getGeyserConfig(serverDir);
  });
  electron.ipcMain.handle("geyser:save-config", (_, { serverId, config }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    GeyserService.ensureGeyserConfig(serverDir, config);
    return true;
  });
  electron.ipcMain.handle("plugins:get-catalog", () => {
    return PluginManagerService.getPopularCatalog();
  });
  electron.ipcMain.handle("plugins:get-installed", (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return PluginManagerService.getInstalledPlugins(serverDir);
  });
  electron.ipcMain.handle("plugins:install", async (_, { serverId, pluginId }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return await PluginManagerService.installPlugin(serverDir, pluginId);
  });
  electron.ipcMain.handle("plugins:toggle", (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return PluginManagerService.togglePlugin(serverDir, filename);
  });
  electron.ipcMain.handle("plugins:delete", (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return PluginManagerService.deletePlugin(serverDir, filename);
  });
  electron.ipcMain.handle("plugins:ensure-skins-restorer", async (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    await PluginManagerService.ensureSkinsRestorer(serverDir);
    return true;
  });
}
function registerConfigIpc(mainWindow2) {
  electron.ipcMain.handle("app:get-setup-status", () => {
    return {
      isSetupComplete: AppPaths.isSetupComplete(),
      storageDirectory: AppPaths.getBaseDir()
    };
  });
  electron.ipcMain.handle("app:validate-directory", (_, targetPath) => {
    return AppPaths.validateDirectory(targetPath);
  });
  electron.ipcMain.handle("app:set-storage-directory", (_, targetPath) => {
    AppPaths.setStorageDir(targetPath);
    return true;
  });
  electron.ipcMain.handle("dialog:browse-directory", async () => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: "Select Directory for Server Files",
        properties: ["openDirectory"],
        buttonLabel: "Select Folder"
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return null;
      }
      const selectedPath = result.filePaths[0];
      const validation = AppPaths.validateDirectory(selectedPath);
      return {
        path: selectedPath,
        validation
      };
    } catch (e) {
      console.error("Error in dialog:browse-directory", e);
      return null;
    }
  });
  electron.ipcMain.handle("setup:check-dependencies", async () => {
    const { DependencySetupService } = await Promise.resolve().then(() => require("./dependency-setup.service-CRpe2MC_.js"));
    return await DependencySetupService.checkAllDependencies();
  });
  electron.ipcMain.handle("setup:install-dependency", async (_, id) => {
    const { DependencySetupService } = await Promise.resolve().then(() => require("./dependency-setup.service-CRpe2MC_.js"));
    return await DependencySetupService.installDependency(id, (percent, message) => {
      mainWindow2.webContents.send("setup:dependency-progress", { id, percent, message });
    });
  });
  electron.ipcMain.handle("config:read-properties", (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ConfigParserService.readProperties(serverDir);
  });
  electron.ipcMain.handle("config:write-properties", (_, { serverId, properties }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    ConfigParserService.writeProperties(serverDir, properties);
    return true;
  });
  electron.ipcMain.handle("config:set-cracked", (_, { serverId, isCracked }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    ConfigParserService.setCrackedMode(serverDir, isCracked);
    return true;
  });
  electron.ipcMain.on("window:minimize", () => {
    mainWindow2.minimize();
  });
  electron.ipcMain.on("window:maximize", () => {
    if (mainWindow2.isMaximized()) {
      mainWindow2.unmaximize();
    } else {
      mainWindow2.maximize();
    }
  });
  electron.ipcMain.on("window:close", () => {
    mainWindow2.close();
  });
  electron.ipcMain.handle("paths:get-servers-dir", () => {
    return AppPaths.getServersDir();
  });
  electron.ipcMain.handle("servers:list", () => {
    const sDir = AppPaths.getServersDir();
    if (!fs.existsSync(sDir)) return [];
    const entries = fs.readdirSync(sDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => {
      const serverPath = path.join(sDir, e.name);
      const props = ConfigParserService.readProperties(serverPath);
      let meta = {};
      const metaPath = path.join(serverPath, "craftora.json");
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        } catch (err) {
          console.warn("Failed to parse server metadata for", e.name, err);
        }
      }
      return {
        id: e.name,
        name: meta.name || e.name,
        path: serverPath,
        serverSoftware: meta.serverSoftware || "paper",
        version: meta.version || "1.21.4",
        allocatedRamGb: meta.allocatedRamGb || 4,
        javaPath: meta.javaPath || "java",
        useAikarFlags: meta.useAikarFlags !== false,
        port: props["server-port"] || meta.port || 25565,
        isCracked: props["online-mode"] === false || meta.isCracked === true,
        networkMode: meta.networkMode === "lan_only" ? "lan_only" : meta.networkMode === "upnp" ? "upnp" : "cloud_relay",
        motd: props["motd"] || meta.motd || "Craftora Server",
        keepInventory: meta.keepInventory !== void 0 ? meta.keepInventory : true,
        showCoordinates: meta.showCoordinates !== void 0 ? meta.showCoordinates : true,
        onePlayerSleep: meta.onePlayerSleep !== void 0 ? meta.onePlayerSleep : true,
        disableMobGriefing: meta.disableMobGriefing !== void 0 ? meta.disableMobGriefing : false,
        disableFireSpread: meta.disableFireSpread !== void 0 ? meta.disableFireSpread : false
      };
    });
  });
  electron.ipcMain.handle("servers:save-config", (_, { serverId, config }) => {
    try {
      const serverDir = AppPaths.getServerPath(serverId);
      AppPaths.ensureDir(serverDir);
      const metaPath = path.join(serverDir, "craftora.json");
      let existing = {};
      if (fs.existsSync(metaPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        } catch (e) {
        }
      }
      const updated = { ...existing, ...config };
      fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), "utf8");
      return true;
    } catch (err) {
      console.error("Failed to save server config", err);
      return false;
    }
  });
  electron.ipcMain.handle("servers:delete", async (_, serverId) => {
    try {
      const serverDir = path.join(AppPaths.getServersDir(), serverId);
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to delete server directory", serverId, err);
      throw err;
    }
  });
  electron.ipcMain.handle("system:open-external", async (_, url2) => {
    if (url2 && (url2.startsWith("http://") || url2.startsWith("https://"))) {
      await electron.shell.openExternal(url2);
      return true;
    }
    return false;
  });
}
const logger = new Logger("Main");
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = electron.app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
electron.app.commandLine.appendSwitch("enable-gpu-rasterization");
electron.app.commandLine.appendSwitch("enable-zero-copy");
electron.app.commandLine.appendSwitch("disable-software-rasterizer");
electron.app.commandLine.appendSwitch("disable-http-cache");
electron.app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
let mainWindow = null;
async function createWindow() {
  AppPaths.init();
  const iconPath = process.platform === "win32" ? path.join(__dirname, "../src/assets/DC.ico") : path.join(__dirname, "../src/assets/DC.png");
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1050,
    minHeight: 680,
    frame: false,
    // Frameless for modern custom titlebar & Obsidian aesthetic
    titleBarStyle: "hidden",
    backgroundColor: "#090d16",
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: true
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: url2 }) => {
    if (url2.startsWith("https://") || url2.startsWith("http://")) {
      electron.shell.openExternal(url2);
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url2) => {
    if (url2.startsWith("http://") || url2.startsWith("https://")) {
      const isDevUrl = process.env.VITE_DEV_SERVER_URL && url2.startsWith(process.env.VITE_DEV_SERVER_URL);
      if (!isDevUrl) {
        event.preventDefault();
        electron.shell.openExternal(url2);
      }
    }
  });
  registerServerIpc(mainWindow);
  registerNetworkIpc(mainWindow);
  registerPluginsIpc();
  registerConfigIpc(mainWindow);
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    logger.info("Craftora main window displayed");
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
electron.app.whenReady().then(createWindow);
electron.app.on("window-all-closed", async () => {
  logger.info("Shutting down services and network tunnels...");
  await ServerManagerService.stopServer();
  await PlayitService.stopTunnel();
  await UpnpService.closePort();
  LanBroadcastService.stopBroadcasting();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
exports.AppPaths = AppPaths;
exports.JarDownloaderService = JarDownloaderService;
exports.JavaDetectorService = JavaDetectorService;
exports.Logger = Logger;
exports.PlayitService = PlayitService;
