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
const util$1 = require("util");
const https = require("https");
const http = require("http");
const dgram = require("dgram");
const url = require("url");
const net = require("net");
const require$$0 = require("zlib");
const require$$0$1 = require("crypto");
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
const logger$a = new Logger("ConfigParser");
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
    logger$a.info(`EULA accepted for server at: ${serverDir}`);
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
      logger$a.error("Failed to read server.properties", e);
      return defaultProperties;
    }
  }
  /**
   * Async version of readProperties for optimized concurrent startup parsing.
   */
  static async readPropertiesAsync(serverDir) {
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
    try {
      try {
        await fs.promises.access(propPath);
      } catch {
        return defaultProperties;
      }
      const content = await fs.promises.readFile(propPath, "utf-8");
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
      logger$a.error("Failed to read server.properties asynchronously", e);
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
    logger$a.info(`server.properties updated for server at: ${serverDir}`);
  }
  /**
   * Sets cracked (offline) mode on or off.
   */
  static setCrackedMode(serverDir, isCracked) {
    this.writeProperties(serverDir, {
      "online-mode": !isCracked
    });
    logger$a.info(`Cracked mode set to: ${isCracked} (online-mode=${!isCracked})`);
  }
}
const execAsync = util$1.promisify(child_process.exec);
const logger$9 = new Logger("JavaDetector");
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
    logger$9.info(`Downloading portable OpenJDK ${majorVersion} from ${downloadUrl}...`);
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
    logger$9.info(`Extracting OpenJDK ${majorVersion} to ${targetDir}...`);
    AppPaths.ensureDir(targetDir);
    try {
      await execAsync(`tar -xf "${zipPath}" -C "${targetDir}"`);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      this.clearCache();
      const found = this.findJavaInDir(targetDir);
      logger$9.info(`OpenJDK ${majorVersion} ready at: ${found}`);
      return found;
    } catch (tarErr) {
      try {
        await execAsync(`powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        this.clearCache();
        return this.findJavaInDir(targetDir);
      } catch (psErr) {
        logger$9.error(`Failed to extract OpenJDK ${majorVersion}`, psErr);
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
    logger$9.info(`Downloading Java 21 installer to ${destPath}`);
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
    logger$9.info(`Launching Java installer: ${destPath}`);
    child_process.spawn("cmd.exe", ["/c", "start", '""', destPath], { detached: true, stdio: "ignore" });
    return true;
  }
}
__publicField(JavaDetectorService, "cachedRuntimes", null);
const logger$8 = new Logger("ServerManager");
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
      logger$8.warn("Server is already running or starting");
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
        logger$8.info(`Server process exited with code ${code}, signal ${signal}`);
        this.emitLog(`[Craftora] Server stopped with exit code: ${code}`, "system");
        this.cleanUpProcess();
        this.setStatus("STOPPED");
      });
      this.activeProcess.on("error", (err) => {
        logger$8.error("Failed to spawn server process", err);
        this.emitLog(`[Craftora] Process error: ${err.message}`, "system");
        this.cleanUpProcess();
        this.setStatus("CRASHED");
      });
      this.startMetricsMonitor();
      return true;
    } catch (err) {
      logger$8.error("Failed to start server", err);
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
        logger$8.warn("Failed to write stop command, terminating process", e);
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
      logger$8.error("Failed to send command", e);
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
    const logEntry = { line, type };
    this.logHistory.push(logEntry);
    if (this.logHistory.length > 800) {
      this.logHistory.shift();
    }
    this.logBatch.push(logEntry);
    if (this.logBatch.length >= 100) {
      this.flushLogs();
    } else if (!this.logFlushTimer) {
      this.logFlushTimer = setTimeout(() => {
        this.flushLogs();
      }, 100);
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
  static getLogHistory() {
    return [...this.logHistory];
  }
  static clearLogs() {
    this.logHistory = [];
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
__publicField(ServerManagerService, "logHistory", []);
const logger$7 = new Logger("JarDownloader");
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
      logger$7.error("Failed to fetch versions for " + software, err);
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
    logger$7.info(`Resolving download URL for ${software} ${version}...`);
    const downloadUrl = await this.resolveDownloadUrl(software, version);
    logger$7.info(`Downloading jar from: ${downloadUrl}`);
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
    logger$7.info(`Server jar downloaded successfully to: ${targetPath}`);
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
        logger$7.warn("Paper V3 lookup failed, attempting V2 endpoint", v3Err);
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
  electron.ipcMain.handle("server:get-logs", () => {
    return ServerManagerService.getLogHistory();
  });
  electron.ipcMain.handle("server:clear-logs", () => {
    ServerManagerService.clearLogs();
    return true;
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
const logger$6 = new Logger("UpnpService");
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
        logger$6.warn("SSDP UDP socket error", err);
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
          logger$6.warn("Failed to send SSDP query", e);
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
      logger$6.warn("Failed to resolve UPnP IGD endpoint", e);
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
      logger$6.warn("Failed to query router External IP via UPnP", e);
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
        logger$6.info("Probing local router for UPnP IGD capability...");
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
          logger$6.info("UPnP not supported on current gateway.");
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
        logger$6.info(`UPnP is supported on router (${endpoint.friendlyName}), ExtIP: ${externalIp}`);
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
      logger$6.info(`Forwarding UPnP ${protocol} port ${port} -> ${localIp}:${port}...`);
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
      logger$6.info(`UPnP Port ${port} successfully opened! Join address: ${extIp}:${port}`);
      return { ...this.currentStatus };
    } catch (err) {
      logger$6.error("Failed to open UPnP port mapping", err);
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
        logger$6.info(`Releasing UPnP port mapping ${protocol} ${port}...`);
        await this.sendSoapAction(this.cachedEndpoint, "DeletePortMapping", {
          NewRemoteHost: "",
          NewExternalPort: port.toString(),
          NewProtocol: protocol
        });
      }
    } catch (e) {
      logger$6.warn("Failed to delete UPnP port mapping cleanly", e);
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
const logger$5 = new Logger("PlayitService");
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
        logger$5.warn("Error in status listener", e);
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
      logger$5.warn("Detected oversized playit daemon binary (v1.0.10) — removing and scheduling re-download of v0.17.1");
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
    logger$5.info(`Downloading official playit tunnel binary to: ${binPath}`);
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
                logger$5.info("PlayIt.gg Agent binary downloaded successfully.");
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
      const headers2 = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "playit-agent/1.0.10"
      };
      if (secretKey) {
        headers2["Authorization"] = `agent-key ${secretKey}`;
      }
      const req = https.request(`https://api.playit.gg${endpoint}`, {
        method: "POST",
        headers: headers2,
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
      logger$5.info(`Found existing PlayIt secret at ${existingSecret.path}. Skipping claim flow and auto-starting tunnel.`);
      try {
        fs.writeFileSync(workspaceToml, existingSecret.content, "utf8");
      } catch {
      }
      setTimeout(() => this.startTunnel(port), 500);
      return this.currentStatus;
    }
    logger$5.info("Spawning playit.exe with no arguments to generate claim URL...");
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
      logger$5.info(`[PlayitClaim] ${text.trim()}`);
      if (!claimUrlFound) {
        const claimMatch = text.match(/https:\/\/playit\.gg\/claim\/([a-z0-9]+)/i);
        if (claimMatch) {
          claimUrlFound = true;
          const claimUrl = claimMatch[0];
          logger$5.info(`Claim URL detected from playit.exe output: ${claimUrl}`);
          this.updateStatus({
            status: "WAITING_CLAIM",
            claimUrl
          });
          try {
            electron.shell.openExternal(claimUrl);
          } catch (err) {
            logger$5.warn("Failed to auto-open claim URL in browser", err);
          }
          this.startSecretWatcher(port, child);
        }
      }
      const addressMatch = text.match(/([a-zA-Z0-9_\-]+\.craft\.ply\.gg(?::\d+)?)/i) || text.match(/([a-zA-Z0-9_\-]+\.tun\.ply\.gg(?::\d+)?)/i) || text.match(/([a-zA-Z0-9_\-]+\.ply\.gg:\d+)/i) || text.match(/([a-zA-Z0-9_\-]+\.playit\.gg:\d+)/i);
      if (addressMatch && addressMatch[1]) {
        const cleanAddress = addressMatch[1].trim().replace(/^tcp:\/\//i, "");
        if (!cleanAddress.includes("localhost") && !cleanAddress.includes("127.0.0.1")) {
          logger$5.info(`PlayIt.gg Tunnel Active (from output): ${cleanAddress}`);
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
      logger$5.error("PlayIt.gg claim process error", err);
      this.updateStatus({ isActive: false, status: "ERROR", error: err.message });
    });
    child.on("close", (code) => {
      logger$5.info(`PlayIt.gg claim process closed with code ${code}`);
      this.childProcess = null;
      if (this.currentStatus.status === "WAITING_CLAIM") {
        logger$5.info("Process exited during WAITING_CLAIM — searching for secret file written by agent...");
        const found = this.findSecretInKnownPaths();
        if (found) {
          logger$5.info(`Secret found at: ${found.path} — restarting tunnel with secret.`);
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
          logger$5.info("No secret found on exit — continuing to watch for config file...");
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
          logger$5.info(`Found secret in: ${candidate}`);
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
    logger$5.info("Secret watcher started — polling all known PlayIt.gg config locations...");
    this.claimWatchInterval = setInterval(async () => {
      try {
        const found = this.findSecretInKnownPaths();
        if (!found) return;
        logger$5.info("Secret key obtained from playit.gg claim! Transitioning to tunnel mode...");
        if (this.claimWatchInterval) {
          clearInterval(this.claimWatchInterval);
          this.claimWatchInterval = null;
        }
        try {
          fs.writeFileSync(workspaceToml, found.content, "utf8");
        } catch {
        }
        logger$5.info("PlayIt agent successfully claimed. Starting API polling...");
        this.updateStatus({
          isActive: true,
          status: "ONLINE",
          serverAddress: null,
          claimUrl: null,
          error: null
        });
        this.startApiPolling(found.secret, port);
      } catch (e) {
        logger$5.warn("Error in secret watcher", e);
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
      logger$5.warn("Failed to query public tunnel address from API", e);
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
        logger$5.info(`PlayIt.gg Agent authenticated. Address: ${result.address || "none yet"}, Bedrock: ${result.bedrockAddress || "none yet"}`);
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
      logger$5.info(`Starting PlayIt.gg process with secret: ${binPath}`);
      const child = child_process.spawn(binPath, ["--secret_path", configPath, "--stdout", "start"], {
        cwd: workingDir,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      });
      this.childProcess = child;
      const handleOutput = async (data) => {
        const text = data.toString("utf-8");
        const lines = text.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const isSpam = trimmed.includes("tunnel running") || trimmed.includes("udp session details received") || trimmed.includes("udp channel requires auth") || trimmed.includes("send KeepAlive") || trimmed.includes("playit_agent_core::") || trimmed.includes("playit_cli::ui: playit") || trimmed.includes("clear old:") || trimmed.includes("pipe ended due to EOF") || trimmed.includes("authenticate control") || trimmed.includes("session expired") || trimmed.includes("tunnel_addr") || trimmed.includes("pong=Pong") || trimmed.includes("agent registered") || trimmed.includes("New TCP Client details=");
          if (!isSpam) {
            logger$5.info(`[PlayitAgent] ${trimmed}`);
          }
        }
        if (text.includes("Invalid secret")) {
          logger$5.warn("PlayIt Agent detected an invalid secret! Auto-resetting and returning to claim flow...");
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
            logger$5.info(`PlayIt.gg Tunnel Online: ${cleanAddress}`);
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
        logger$5.error("PlayIt.gg process encountered an error", err);
        this.updateStatus({
          isActive: false,
          status: "ERROR",
          error: err.message || "Failed to start PlayIt.gg process."
        });
      });
      child.on("close", (code) => {
        logger$5.info(`PlayIt.gg process exited with code ${code}`);
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
      logger$5.error("Failed to start PlayIt.gg tunnel", err);
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
      logger$5.info("Stopping PlayIt.gg background process...");
      try {
        if (process.platform === "win32" && this.childProcess.pid) {
          child_process.spawn("taskkill", ["/pid", this.childProcess.pid.toString(), "/f", "/t"]);
        } else {
          this.childProcess.kill("SIGINT");
        }
      } catch (e) {
        logger$5.warn("Failed to kill PlayIt.gg process cleanly", e);
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
const logger$4 = new Logger("LanBroadcast");
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
        logger$4.info(`LAN discovery broadcaster started on ${this.MULTICAST_ADDRESS}:${this.MULTICAST_PORT}`);
        this.intervalTimer = setInterval(() => {
          if (!this.socket || !this.isRunning) return;
          this.socket.send(buffer, 0, buffer.length, this.MULTICAST_PORT, this.MULTICAST_ADDRESS, (err) => {
            if (err) {
              logger$4.debug("Error sending LAN packet", err);
            }
          });
        }, 1500);
      });
      this.socket.on("error", (err) => {
        logger$4.warn("LAN Broadcast socket error", err);
      });
    } catch (e) {
      logger$4.error("Failed to start LAN broadcaster", e);
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
    logger$4.info("LAN discovery broadcaster stopped");
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
const logger$3 = new Logger("GeyserService");
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
    logger$3.info("Downloading GeyserMC Spigot plugin...");
    await JarDownloaderService.downloadFile(this.GEYSER_SPIGOT_URL, geyserDest, (percent) => {
      if (onProgress) onProgress("GeyserMC", percent);
    });
    logger$3.info("Downloading Floodgate Spigot plugin...");
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
    logger$3.info("GeyserMC & Floodgate cross-play setup complete!");
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
      logger$3.error("Failed to read Geyser config.yml", e);
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
    logger$3.info(`Geyser configuration written to: ${configPath}`);
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
    logger$3.info("GeyserMC and Floodgate plugins removed");
  }
}
__publicField(GeyserService, "GEYSER_SPIGOT_URL", "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot");
__publicField(GeyserService, "FLOODGATE_SPIGOT_URL", "https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot");
const logger$2 = new Logger("PluginManager");
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
      logger$2.error("Failed to list plugins", e);
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
                logger$2.info(`Resolved latest ${popular.name} from Modrinth CDN: ${jarFile.filename}`);
                return jarFile.url;
              }
            }
          }
        }
      } catch (modrinthErr) {
        logger$2.warn(`Modrinth API lookup for ${pluginId} failed, falling back to static URL`, modrinthErr);
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
            logger$2.info(`Installed plugin ${popular.name} from local workspace cache.`);
            if (onProgress) onProgress(100);
            return destFile;
          }
        }
      }
    } catch (e) {
      logger$2.warn("Failed to check plugin cache", e);
    }
    let downloadUrl = popular.downloadUrl;
    try {
      downloadUrl = await this.resolvePluginUrl(pluginId);
    } catch {
      downloadUrl = popular.downloadUrl;
    }
    logger$2.info(`Installing plugin ${popular.name} from ${downloadUrl} to ${destFile}...`);
    try {
      await JarDownloaderService.downloadFile(downloadUrl, destFile, onProgress);
      logger$2.info(`Plugin ${popular.name} installed successfully!`);
      return destFile;
    } catch (err) {
      if (downloadUrl !== popular.downloadUrl) {
        logger$2.warn(`Retrying ${popular.name} with static fallback URL: ${popular.downloadUrl}`);
        await JarDownloaderService.downloadFile(popular.downloadUrl, destFile, onProgress);
        return destFile;
      }
      logger$2.error(`Failed to download plugin ${popular.name}`, err);
      throw err;
    }
  }
  /**
   * Installs a plugin directly from Spiget API using its resource ID.
   */
  static async installSpigetPlugin(serverDir, spigetId, pluginName, onProgress) {
    const pluginsDir = path.join(serverDir, "plugins");
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }
    const safeName = pluginName.replace(/[^a-zA-Z0-9_\-\ ]/g, "").trim().replace(/\ /g, "_");
    const destFile = path.join(pluginsDir, `${safeName}.jar`);
    const downloadUrl = `https://api.spiget.org/v2/resources/${spigetId}/download`;
    logger$2.info(`Installing Spiget plugin ${pluginName} (ID: ${spigetId}) from ${downloadUrl} to ${destFile}...`);
    try {
      await JarDownloaderService.downloadFile(downloadUrl, destFile, onProgress);
      logger$2.info(`Spiget Plugin ${pluginName} installed successfully!`);
      return destFile;
    } catch (err) {
      logger$2.error(`Failed to download Spiget plugin ${pluginName}`, err);
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
      logger$2.info("Auto-installing SkinsRestorer for cracked server support...");
      try {
        await this.installPlugin(serverDir, "skinsrestorer");
      } catch (e) {
        logger$2.warn("Could not auto-download SkinsRestorer", e);
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
  electron.ipcMain.handle("plugins:install-spiget", async (_, { serverId, spigetId, pluginName }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return await PluginManagerService.installSpigetPlugin(serverDir, spigetId, pluginName);
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
    const { DependencySetupService } = await Promise.resolve().then(() => require("./dependency-setup.service-CkzjI0_o.js"));
    return await DependencySetupService.checkAllDependencies();
  });
  electron.ipcMain.handle("setup:install-dependency", async (_, id) => {
    const { DependencySetupService } = await Promise.resolve().then(() => require("./dependency-setup.service-CkzjI0_o.js"));
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
  electron.ipcMain.handle("servers:list", async () => {
    const sDir = AppPaths.getServersDir();
    try {
      await fs.promises.access(sDir);
    } catch {
      return [];
    }
    const entries = await fs.promises.readdir(sDir, { withFileTypes: true });
    const serverPromises = entries.filter((e) => e.isDirectory()).map(async (e) => {
      const serverPath = path.join(sDir, e.name);
      const props = await ConfigParserService.readPropertiesAsync(serverPath);
      let meta = {};
      const metaPath = path.join(serverPath, "craftora.json");
      try {
        const metaContent = await fs.promises.readFile(metaPath, "utf8");
        meta = JSON.parse(metaContent);
      } catch (err) {
        if (err.code !== "ENOENT") {
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
    return await Promise.all(serverPromises);
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
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var util = { exports: {} };
var constants;
var hasRequiredConstants;
function requireConstants() {
  if (hasRequiredConstants) return constants;
  hasRequiredConstants = 1;
  constants = {
    /* The local file header */
    LOCHDR: 30,
    // LOC header size
    LOCSIG: 67324752,
    // "PK\003\004"
    LOCVER: 4,
    // version needed to extract
    LOCFLG: 6,
    // general purpose bit flag
    LOCHOW: 8,
    // compression method
    LOCTIM: 10,
    // modification time (2 bytes time, 2 bytes date)
    LOCCRC: 14,
    // uncompressed file crc-32 value
    LOCSIZ: 18,
    // compressed size
    LOCLEN: 22,
    // uncompressed size
    LOCNAM: 26,
    // filename length
    LOCEXT: 28,
    // extra field length
    /* The Data descriptor */
    EXTSIG: 134695760,
    // "PK\007\008"
    EXTHDR: 16,
    // EXT header size
    EXTCRC: 4,
    // uncompressed file crc-32 value
    EXTSIZ: 8,
    // compressed size
    EXTLEN: 12,
    // uncompressed size
    /* The central directory file header */
    CENHDR: 46,
    // CEN header size
    CENSIG: 33639248,
    // "PK\001\002"
    CENVEM: 4,
    // version made by
    CENVER: 6,
    // version needed to extract
    CENFLG: 8,
    // encrypt, decrypt flags
    CENHOW: 10,
    // compression method
    CENTIM: 12,
    // modification time (2 bytes time, 2 bytes date)
    CENCRC: 16,
    // uncompressed file crc-32 value
    CENSIZ: 20,
    // compressed size
    CENLEN: 24,
    // uncompressed size
    CENNAM: 28,
    // filename length
    CENEXT: 30,
    // extra field length
    CENCOM: 32,
    // file comment length
    CENDSK: 34,
    // volume number start
    CENATT: 36,
    // internal file attributes
    CENATX: 38,
    // external file attributes (host system dependent)
    CENOFF: 42,
    // LOC header offset
    /* The entries in the end of central directory */
    ENDHDR: 22,
    // END header size
    ENDSIG: 101010256,
    // "PK\005\006"
    ENDSUB: 8,
    // number of entries on this disk
    ENDTOT: 10,
    // total number of entries
    ENDSIZ: 12,
    // central directory size in bytes
    ENDOFF: 16,
    // offset of first CEN header
    ENDCOM: 20,
    // zip file comment length
    END64HDR: 20,
    // zip64 END header size
    END64SIG: 117853008,
    // zip64 Locator signature, "PK\006\007"
    END64START: 4,
    // number of the disk with the start of the zip64
    END64OFF: 8,
    // relative offset of the zip64 end of central directory
    END64NUMDISKS: 16,
    // total number of disks
    ZIP64SIG: 101075792,
    // zip64 signature, "PK\006\006"
    ZIP64HDR: 56,
    // zip64 record minimum size
    ZIP64LEAD: 12,
    // leading bytes at the start of the record, not counted by the value stored in ZIP64SIZE
    ZIP64SIZE: 4,
    // zip64 size of the central directory record
    ZIP64VEM: 12,
    // zip64 version made by
    ZIP64VER: 14,
    // zip64 version needed to extract
    ZIP64DSK: 16,
    // zip64 number of this disk
    ZIP64DSKDIR: 20,
    // number of the disk with the start of the record directory
    ZIP64SUB: 24,
    // number of entries on this disk
    ZIP64TOT: 32,
    // total number of entries
    ZIP64SIZB: 40,
    // zip64 central directory size in bytes
    ZIP64OFF: 48,
    // offset of start of central directory with respect to the starting disk number
    ZIP64EXTRA: 56,
    // extensible data sector
    /* Compression methods */
    STORED: 0,
    // no compression
    SHRUNK: 1,
    // shrunk
    REDUCED1: 2,
    // reduced with compression factor 1
    REDUCED2: 3,
    // reduced with compression factor 2
    REDUCED3: 4,
    // reduced with compression factor 3
    REDUCED4: 5,
    // reduced with compression factor 4
    IMPLODED: 6,
    // imploded
    // 7 reserved for Tokenizing compression algorithm
    DEFLATED: 8,
    // deflated
    ENHANCED_DEFLATED: 9,
    // enhanced deflated
    PKWARE: 10,
    // PKWare DCL imploded
    // 11 reserved by PKWARE
    BZIP2: 12,
    //  compressed using BZIP2
    // 13 reserved by PKWARE
    LZMA: 14,
    // LZMA
    // 15-17 reserved by PKWARE
    IBM_TERSE: 18,
    // compressed using IBM TERSE
    IBM_LZ77: 19,
    // IBM LZ77 z
    AES_ENCRYPT: 99,
    // WinZIP AES encryption method
    /* General purpose bit flag */
    // values can obtained with expression 2**bitnr
    FLG_ENC: 1,
    // Bit 0: encrypted file
    FLG_COMP1: 2,
    // Bit 1, compression option
    FLG_COMP2: 4,
    // Bit 2, compression option
    FLG_DESC: 8,
    // Bit 3, data descriptor
    FLG_ENH: 16,
    // Bit 4, enhanced deflating
    FLG_PATCH: 32,
    // Bit 5, indicates that the file is compressed patched data.
    FLG_STR: 64,
    // Bit 6, strong encryption (patented)
    // Bits 7-10: Currently unused.
    FLG_EFS: 2048,
    // Bit 11: Language encoding flag (EFS)
    // Bit 12: Reserved by PKWARE for enhanced compression.
    // Bit 13: encrypted the Central Directory (patented).
    // Bits 14-15: Reserved by PKWARE.
    FLG_MSK: 4096,
    // mask header values
    /* Load type */
    FILE: 2,
    BUFFER: 1,
    NONE: 0,
    /* 4.5 Extensible data fields */
    EF_ID: 0,
    EF_SIZE: 2,
    /* Header IDs */
    ID_ZIP64: 1,
    ID_AVINFO: 7,
    ID_PFS: 8,
    ID_OS2: 9,
    ID_NTFS: 10,
    ID_OPENVMS: 12,
    ID_UNIX: 13,
    ID_FORK: 14,
    ID_PATCH: 15,
    ID_X509_PKCS7: 20,
    ID_X509_CERTID_F: 21,
    ID_X509_CERTID_C: 22,
    ID_STRONGENC: 23,
    ID_RECORD_MGT: 24,
    ID_X509_PKCS7_RL: 25,
    ID_IBM1: 101,
    ID_IBM2: 102,
    ID_POSZIP: 18064,
    EF_ZIP64_OR_32: 4294967295,
    EF_ZIP64_OR_16: 65535,
    EF_ZIP64_SUNCOMP: 0,
    EF_ZIP64_SCOMP: 8,
    EF_ZIP64_RHO: 16,
    EF_ZIP64_DSN: 24
  };
  return constants;
}
var errors = {};
var hasRequiredErrors;
function requireErrors() {
  if (hasRequiredErrors) return errors;
  hasRequiredErrors = 1;
  (function(exports2) {
    const errors2 = {
      /* Header error messages */
      INVALID_LOC: "Invalid LOC header (bad signature)",
      INVALID_CEN: "Invalid CEN header (bad signature)",
      INVALID_END: "Invalid END header (bad signature)",
      /* Descriptor */
      DESCRIPTOR_NOT_EXIST: "No descriptor present",
      DESCRIPTOR_UNKNOWN: "Unknown descriptor format",
      DESCRIPTOR_FAULTY: "Descriptor data is malformed",
      /* ZipEntry error messages*/
      NO_DATA: "Nothing to decompress",
      BAD_CRC: "CRC32 checksum failed {0}",
      FILE_IN_THE_WAY: "There is a file in the way: {0}",
      UNKNOWN_METHOD: "Invalid/unsupported compression method",
      /* Inflater error messages */
      AVAIL_DATA: "inflate::Available inflate data did not terminate",
      INVALID_DISTANCE: "inflate::Invalid literal/length or distance code in fixed or dynamic block",
      TO_MANY_CODES: "inflate::Dynamic block code description: too many length or distance codes",
      INVALID_REPEAT_LEN: "inflate::Dynamic block code description: repeat more than specified lengths",
      INVALID_REPEAT_FIRST: "inflate::Dynamic block code description: repeat lengths with no first length",
      INCOMPLETE_CODES: "inflate::Dynamic block code description: code lengths codes incomplete",
      INVALID_DYN_DISTANCE: "inflate::Dynamic block code description: invalid distance code lengths",
      INVALID_CODES_LEN: "inflate::Dynamic block code description: invalid literal/length code lengths",
      INVALID_STORE_BLOCK: "inflate::Stored block length did not match one's complement",
      INVALID_BLOCK_TYPE: "inflate::Invalid block type (type == 3)",
      /* ADM-ZIP error messages */
      CANT_EXTRACT_FILE: "Could not extract the file",
      CANT_OVERRIDE: "Target file already exists",
      DISK_ENTRY_TOO_LARGE: "Number of disk entries is too large",
      NO_ZIP: "No zip file was loaded",
      NO_ENTRY: "Entry doesn't exist",
      DIRECTORY_CONTENT_ERROR: "A directory cannot have content",
      FILE_NOT_FOUND: 'File not found: "{0}"',
      NOT_IMPLEMENTED: "Not implemented",
      INVALID_FILENAME: "Invalid filename",
      INVALID_FORMAT: "Invalid or unsupported zip format. No END header found",
      INVALID_PASS_PARAM: "Incompatible password parameter",
      WRONG_PASSWORD: "Wrong Password",
      /* ADM-ZIP */
      COMMENT_TOO_LONG: "Comment is too long",
      // Comment can be max 65535 bytes long (NOTE: some non-US characters may take more space)
      EXTRA_FIELD_PARSE_ERROR: "Extra field parsing error"
    };
    function E(message) {
      return function(...args) {
        if (args.length) {
          message = message.replace(/\{(\d)\}/g, (_, n) => args[n] || "");
        }
        return new Error("ADM-ZIP: " + message);
      };
    }
    for (const msg of Object.keys(errors2)) {
      exports2[msg] = E(errors2[msg]);
    }
  })(errors);
  return errors;
}
var utils;
var hasRequiredUtils;
function requireUtils() {
  if (hasRequiredUtils) return utils;
  hasRequiredUtils = 1;
  const fsystem = fs;
  const pth = path;
  const Constants = requireConstants();
  const Errors = requireErrors();
  const isWin = typeof process === "object" && "win32" === process.platform;
  const is_Obj = (obj) => typeof obj === "object" && obj !== null;
  const crcTable = new Uint32Array(256).map((t, c) => {
    for (let k = 0; k < 8; k++) {
      if ((c & 1) !== 0) {
        c = 3988292384 ^ c >>> 1;
      } else {
        c >>>= 1;
      }
    }
    return c >>> 0;
  });
  function Utils(opts) {
    this.sep = pth.sep;
    this.fs = fsystem;
    if (is_Obj(opts)) {
      if (is_Obj(opts.fs) && typeof opts.fs.statSync === "function") {
        this.fs = opts.fs;
      }
    }
  }
  utils = Utils;
  Utils.prototype.makeDir = function(folder) {
    const self = this;
    function mkdirSync(fpath) {
      let resolvedPath = fpath.split(self.sep)[0];
      fpath.split(self.sep).forEach(function(name) {
        if (!name || name.substr(-1, 1) === ":") return;
        resolvedPath += self.sep + name;
        var stat;
        try {
          stat = self.fs.statSync(resolvedPath);
        } catch (e) {
          if (e.message && e.message.startsWith("ENOENT")) {
            self.fs.mkdirSync(resolvedPath);
          } else {
            throw e;
          }
        }
        if (stat && stat.isFile()) throw Errors.FILE_IN_THE_WAY(`"${resolvedPath}"`);
      });
    }
    mkdirSync(folder);
  };
  Utils.prototype.writeFileTo = function(path2, content, overwrite, attr) {
    const self = this;
    if (self.fs.existsSync(path2)) {
      if (!overwrite) return false;
      var stat = self.fs.statSync(path2);
      if (stat.isDirectory()) {
        return false;
      }
    }
    var folder = pth.dirname(path2);
    if (!self.fs.existsSync(folder)) {
      self.makeDir(folder);
    }
    var fd;
    try {
      fd = self.fs.openSync(path2, "w", 438);
    } catch (e) {
      self.fs.chmodSync(path2, 438);
      fd = self.fs.openSync(path2, "w", 438);
    }
    if (fd) {
      try {
        self.fs.writeSync(fd, content, 0, content.length, 0);
      } finally {
        self.fs.closeSync(fd);
      }
    }
    self.fs.chmodSync(path2, attr || 438);
    return true;
  };
  Utils.prototype.writeFileToAsync = function(path2, content, overwrite, attr, callback) {
    if (typeof attr === "function") {
      callback = attr;
      attr = void 0;
    }
    const self = this;
    self.fs.exists(path2, function(exist) {
      if (exist && !overwrite) return callback(false);
      self.fs.stat(path2, function(err, stat) {
        if (exist && stat && stat.isDirectory()) {
          return callback(false);
        }
        var folder = pth.dirname(path2);
        self.fs.exists(folder, function(exists) {
          if (!exists) {
            try {
              self.makeDir(folder);
            } catch (e) {
              return callback(false);
            }
          }
          const writeToFd = function(fd) {
            self.fs.write(fd, content, 0, content.length, 0, function(writeErr) {
              self.fs.close(fd, function() {
                if (writeErr) return callback(false);
                self.fs.chmod(path2, attr || 438, function() {
                  callback(true);
                });
              });
            });
          };
          self.fs.open(path2, "w", 438, function(err2, fd) {
            if (err2) {
              self.fs.chmod(path2, 438, function() {
                self.fs.open(path2, "w", 438, function(retryErr, fd2) {
                  if (retryErr || !fd2) return callback(false);
                  writeToFd(fd2);
                });
              });
            } else if (fd) {
              writeToFd(fd);
            } else {
              callback(false);
            }
          });
        });
      });
    });
  };
  Utils.prototype.findFiles = function(path2) {
    const self = this;
    function findSync(dir, pattern, recursive, visited) {
      let files = [];
      self.fs.readdirSync(dir).forEach(function(file) {
        const path3 = pth.join(dir, file);
        const stat = self.fs.statSync(path3);
        {
          files.push(pth.normalize(path3) + (stat.isDirectory() ? self.sep : ""));
        }
        if (stat.isDirectory() && recursive) {
          const realDir = self.fs.realpathSync(path3);
          if (!visited.has(realDir)) {
            visited.add(realDir);
            files = files.concat(findSync(path3, pattern, recursive, visited));
          }
        }
      });
      return files;
    }
    return findSync(path2, void 0, true, /* @__PURE__ */ new Set([self.fs.realpathSync(path2)]));
  };
  Utils.prototype.findFilesAsync = function(dir, cb) {
    const self = this;
    const results = [];
    let finished = false;
    const finish = function(err) {
      if (finished) return;
      finished = true;
      cb(err, err ? void 0 : results);
    };
    const walk = function(dir2, visited, done) {
      self.fs.readdir(dir2, function(err, list) {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done();
        list.forEach(function(name) {
          const file = pth.join(dir2, name);
          self.fs.stat(file, function(err2, stat) {
            if (err2) return done(err2);
            if (!stat) {
              if (!--pending) done();
              return;
            }
            results.push(pth.normalize(file) + (stat.isDirectory() ? self.sep : ""));
            if (!stat.isDirectory()) {
              if (!--pending) done();
              return;
            }
            self.fs.realpath(file, function(err3, realDir) {
              if (err3) return done(err3);
              if (visited.has(realDir)) {
                if (!--pending) done();
                return;
              }
              visited.add(realDir);
              walk(file, visited, function(err4) {
                if (err4) return done(err4);
                if (!--pending) done();
              });
            });
          });
        });
      });
    };
    self.fs.realpath(dir, function(err, realDir) {
      if (err) return finish(err);
      walk(dir, /* @__PURE__ */ new Set([realDir]), finish);
    });
  };
  Utils.prototype.getAttributes = function() {
  };
  Utils.prototype.setAttributes = function() {
  };
  Utils.crc32update = function(crc, byte) {
    return crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  };
  Utils.crc32 = function(buf) {
    if (typeof buf === "string") {
      buf = Buffer.from(buf, "utf8");
    }
    let len = buf.length;
    let crc = -1;
    for (let off = 0; off < len; ) crc = Utils.crc32update(crc, buf[off++]);
    return ~crc >>> 0;
  };
  Utils.methodToString = function(method) {
    switch (method) {
      case Constants.STORED:
        return "STORED (" + method + ")";
      case Constants.DEFLATED:
        return "DEFLATED (" + method + ")";
      default:
        return "UNSUPPORTED (" + method + ")";
    }
  };
  Utils.canonical = function(path2) {
    if (!path2) return "";
    const safeSuffix = pth.posix.normalize("/" + path2.split("\\").join("/"));
    return pth.join(".", safeSuffix);
  };
  Utils.zipnamefix = function(path2) {
    if (!path2) return "";
    const safeSuffix = pth.posix.normalize("/" + path2.split("\\").join("/"));
    return pth.posix.join(".", safeSuffix);
  };
  Utils.findLast = function(arr, callback) {
    if (!Array.isArray(arr)) throw new TypeError("arr is not array");
    const len = arr.length >>> 0;
    for (let i = len - 1; i >= 0; i--) {
      if (callback(arr[i], i, arr)) {
        return arr[i];
      }
    }
    return void 0;
  };
  Utils.sanitize = function(prefix, name) {
    prefix = pth.resolve(pth.normalize(prefix));
    var parts = name.split("/");
    for (var i = 0, l = parts.length; i < l; i++) {
      var path2 = pth.normalize(pth.join(prefix, parts.slice(i, l).join(pth.sep)));
      if (path2 === prefix || path2.startsWith(prefix + pth.sep)) {
        return path2;
      }
    }
    return pth.normalize(pth.join(prefix, pth.basename(name)));
  };
  Utils.toBuffer = function toBuffer(input, encoder) {
    if (Buffer.isBuffer(input)) {
      return input;
    } else if (input instanceof Uint8Array) {
      return Buffer.from(input);
    } else {
      return typeof input === "string" ? encoder(input) : Buffer.alloc(0);
    }
  };
  Utils.readBigUInt64LE = function(buffer, index) {
    const lo = buffer.readUInt32LE(index);
    const hi = buffer.readUInt32LE(index + 4);
    return hi * 4294967296 + lo;
  };
  Utils.writeBigUInt64LE = function(buffer, value, index) {
    const lo = value >>> 0;
    const hi = Math.floor(value / 4294967296) >>> 0;
    buffer.writeUInt32LE(lo, index);
    buffer.writeUInt32LE(hi, index + 4);
  };
  Utils.fromDOS2Date = function(val) {
    return new Date((val >> 25 & 127) + 1980, Math.max((val >> 21 & 15) - 1, 0), Math.max(val >> 16 & 31, 1), val >> 11 & 31, val >> 5 & 63, (val & 31) << 1);
  };
  Utils.fromDate2DOS = function(val) {
    let date = 0;
    let time = 0;
    if (val.getFullYear() > 1979) {
      date = (val.getFullYear() - 1980 & 127) << 9 | val.getMonth() + 1 << 5 | val.getDate();
      time = val.getHours() << 11 | val.getMinutes() << 5 | val.getSeconds() >> 1;
    }
    return date << 16 | time;
  };
  Utils.isWin = isWin;
  Utils.crcTable = crcTable;
  return utils;
}
var fattr;
var hasRequiredFattr;
function requireFattr() {
  if (hasRequiredFattr) return fattr;
  hasRequiredFattr = 1;
  const pth = path;
  fattr = function(path2, { fs: fs2 }) {
    var _path = path2 || "", _obj = newAttr(), _stat = null;
    function newAttr() {
      return {
        directory: false,
        readonly: false,
        hidden: false,
        executable: false,
        mtime: 0,
        atime: 0
      };
    }
    if (_path && fs2.existsSync(_path)) {
      _stat = fs2.statSync(_path);
      _obj.directory = _stat.isDirectory();
      _obj.mtime = _stat.mtime;
      _obj.atime = _stat.atime;
      _obj.executable = (73 & _stat.mode) !== 0;
      _obj.readonly = (128 & _stat.mode) === 0;
      _obj.hidden = pth.basename(_path)[0] === ".";
    } else {
      console.warn("Invalid path: " + _path);
    }
    return {
      get directory() {
        return _obj.directory;
      },
      get readOnly() {
        return _obj.readonly;
      },
      get hidden() {
        return _obj.hidden;
      },
      get mtime() {
        return _obj.mtime;
      },
      get atime() {
        return _obj.atime;
      },
      get executable() {
        return _obj.executable;
      },
      decodeAttributes: function() {
      },
      encodeAttributes: function() {
      },
      toJSON: function() {
        return {
          path: _path,
          isDirectory: _obj.directory,
          isReadOnly: _obj.readonly,
          isHidden: _obj.hidden,
          isExecutable: _obj.executable,
          mTime: _obj.mtime,
          aTime: _obj.atime
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  };
  return fattr;
}
var decoder;
var hasRequiredDecoder;
function requireDecoder() {
  if (hasRequiredDecoder) return decoder;
  hasRequiredDecoder = 1;
  decoder = {
    efs: true,
    encode: (data) => Buffer.from(data, "utf8"),
    decode: (data) => data.toString("utf8")
  };
  return decoder;
}
var hasRequiredUtil;
function requireUtil() {
  if (hasRequiredUtil) return util.exports;
  hasRequiredUtil = 1;
  util.exports = requireUtils();
  util.exports.Constants = requireConstants();
  util.exports.Errors = requireErrors();
  util.exports.FileAttr = requireFattr();
  util.exports.decoder = requireDecoder();
  return util.exports;
}
var headers = {};
var entryHeader;
var hasRequiredEntryHeader;
function requireEntryHeader() {
  if (hasRequiredEntryHeader) return entryHeader;
  hasRequiredEntryHeader = 1;
  var Utils = requireUtil(), Constants = Utils.Constants;
  entryHeader = function() {
    var _verMade = 20, _version = 10, _flags = 0, _method = 0, _time = 0, _crc = 0, _compressedSize = 0, _size = 0, _fnameLen = 0, _extraLen = 0, _comLen = 0, _diskStart = 0, _inattr = 0, _attr = 0, _offset = 0;
    _verMade |= Utils.isWin ? 2560 : 768;
    _flags |= Constants.FLG_EFS;
    const _localHeader = {
      extraLen: 0
    };
    const uint32 = (val) => Math.max(0, val) >>> 0;
    const uint8 = (val) => Math.max(0, val) & 255;
    _time = Utils.fromDate2DOS(/* @__PURE__ */ new Date());
    return {
      get made() {
        return _verMade;
      },
      set made(val) {
        _verMade = val;
      },
      get version() {
        return _version;
      },
      set version(val) {
        _version = val;
      },
      get flags() {
        return _flags;
      },
      set flags(val) {
        _flags = val;
      },
      get flags_efs() {
        return (_flags & Constants.FLG_EFS) > 0;
      },
      set flags_efs(val) {
        if (val) {
          _flags |= Constants.FLG_EFS;
        } else {
          _flags &= ~Constants.FLG_EFS;
        }
      },
      get flags_desc() {
        return (_flags & Constants.FLG_DESC) > 0;
      },
      set flags_desc(val) {
        if (val) {
          _flags |= Constants.FLG_DESC;
        } else {
          _flags &= ~Constants.FLG_DESC;
        }
      },
      get method() {
        return _method;
      },
      set method(val) {
        switch (val) {
          case Constants.STORED:
            this.version = 10;
            break;
          case Constants.DEFLATED:
          default:
            this.version = 20;
        }
        _method = val;
      },
      get time() {
        return Utils.fromDOS2Date(this.timeval);
      },
      set time(val) {
        val = new Date(val);
        this.timeval = Utils.fromDate2DOS(val);
      },
      get timeval() {
        return _time;
      },
      set timeval(val) {
        _time = uint32(val);
      },
      get timeHighByte() {
        return uint8(_time >>> 8);
      },
      get crc() {
        return _crc;
      },
      set crc(val) {
        _crc = uint32(val);
      },
      get compressedSize() {
        return _compressedSize;
      },
      set compressedSize(val) {
        _compressedSize = uint32(val);
      },
      get size() {
        return _size;
      },
      set size(val) {
        _size = uint32(val);
      },
      get fileNameLength() {
        return _fnameLen;
      },
      set fileNameLength(val) {
        _fnameLen = val;
      },
      get extraLength() {
        return _extraLen;
      },
      set extraLength(val) {
        _extraLen = val;
      },
      get extraLocalLength() {
        return _localHeader.extraLen;
      },
      set extraLocalLength(val) {
        _localHeader.extraLen = val;
      },
      get commentLength() {
        return _comLen;
      },
      set commentLength(val) {
        _comLen = val;
      },
      get diskNumStart() {
        return _diskStart;
      },
      set diskNumStart(val) {
        _diskStart = uint32(val);
      },
      get inAttr() {
        return _inattr;
      },
      set inAttr(val) {
        _inattr = uint32(val);
      },
      get attr() {
        return _attr;
      },
      set attr(val) {
        _attr = uint32(val);
      },
      // get Unix file permissions
      get fileAttr() {
        return (_attr || 0) >> 16 & 4095;
      },
      get offset() {
        return _offset;
      },
      set offset(val) {
        _offset = uint32(val);
      },
      get encrypted() {
        return (_flags & Constants.FLG_ENC) === Constants.FLG_ENC;
      },
      get centralHeaderSize() {
        return Constants.CENHDR + _fnameLen + _extraLen + _comLen;
      },
      get realDataOffset() {
        return _offset + Constants.LOCHDR + _localHeader.fnameLen + _localHeader.extraLen;
      },
      get localHeader() {
        return _localHeader;
      },
      loadLocalHeaderFromBinary: function(input) {
        var data = input.slice(_offset, _offset + Constants.LOCHDR);
        if (data.readUInt32LE(0) !== Constants.LOCSIG) {
          throw Utils.Errors.INVALID_LOC();
        }
        _localHeader.version = data.readUInt16LE(Constants.LOCVER);
        _localHeader.flags = data.readUInt16LE(Constants.LOCFLG);
        _localHeader.flags_desc = (_localHeader.flags & Constants.FLG_DESC) > 0;
        _localHeader.method = data.readUInt16LE(Constants.LOCHOW);
        _localHeader.time = data.readUInt32LE(Constants.LOCTIM);
        _localHeader.crc = data.readUInt32LE(Constants.LOCCRC);
        _localHeader.compressedSize = data.readUInt32LE(Constants.LOCSIZ);
        _localHeader.size = data.readUInt32LE(Constants.LOCLEN);
        _localHeader.fnameLen = data.readUInt16LE(Constants.LOCNAM);
        _localHeader.extraLen = data.readUInt16LE(Constants.LOCEXT);
        const extraStart = _offset + Constants.LOCHDR + _localHeader.fnameLen;
        const extraEnd = extraStart + _localHeader.extraLen;
        return input.slice(extraStart, extraEnd);
      },
      loadFromBinary: function(data) {
        if (data.length !== Constants.CENHDR || data.readUInt32LE(0) !== Constants.CENSIG) {
          throw Utils.Errors.INVALID_CEN();
        }
        _verMade = data.readUInt16LE(Constants.CENVEM);
        _version = data.readUInt16LE(Constants.CENVER);
        _flags = data.readUInt16LE(Constants.CENFLG);
        _method = data.readUInt16LE(Constants.CENHOW);
        _time = data.readUInt32LE(Constants.CENTIM);
        _crc = data.readUInt32LE(Constants.CENCRC);
        _compressedSize = data.readUInt32LE(Constants.CENSIZ);
        _size = data.readUInt32LE(Constants.CENLEN);
        _fnameLen = data.readUInt16LE(Constants.CENNAM);
        _extraLen = data.readUInt16LE(Constants.CENEXT);
        _comLen = data.readUInt16LE(Constants.CENCOM);
        _diskStart = data.readUInt16LE(Constants.CENDSK);
        _inattr = data.readUInt16LE(Constants.CENATT);
        _attr = data.readUInt32LE(Constants.CENATX);
        _offset = data.readUInt32LE(Constants.CENOFF);
      },
      localHeaderToBinary: function() {
        var data = Buffer.alloc(Constants.LOCHDR);
        data.writeUInt32LE(Constants.LOCSIG, 0);
        data.writeUInt16LE(_version, Constants.LOCVER);
        data.writeUInt16LE(_flags & ~Constants.FLG_DESC, Constants.LOCFLG);
        data.writeUInt16LE(_method, Constants.LOCHOW);
        data.writeUInt32LE(_time, Constants.LOCTIM);
        data.writeUInt32LE(_crc, Constants.LOCCRC);
        data.writeUInt32LE(_compressedSize, Constants.LOCSIZ);
        data.writeUInt32LE(_size, Constants.LOCLEN);
        data.writeUInt16LE(_fnameLen, Constants.LOCNAM);
        data.writeUInt16LE(_localHeader.extraLen, Constants.LOCEXT);
        return data;
      },
      centralHeaderToBinary: function() {
        var data = Buffer.alloc(Constants.CENHDR + _fnameLen + _extraLen + _comLen);
        data.writeUInt32LE(Constants.CENSIG, 0);
        data.writeUInt16LE(_verMade, Constants.CENVEM);
        data.writeUInt16LE(_version, Constants.CENVER);
        data.writeUInt16LE(_flags & ~Constants.FLG_DESC, Constants.CENFLG);
        data.writeUInt16LE(_method, Constants.CENHOW);
        data.writeUInt32LE(_time, Constants.CENTIM);
        data.writeUInt32LE(_crc, Constants.CENCRC);
        data.writeUInt32LE(_compressedSize, Constants.CENSIZ);
        data.writeUInt32LE(_size, Constants.CENLEN);
        data.writeUInt16LE(_fnameLen, Constants.CENNAM);
        data.writeUInt16LE(_extraLen, Constants.CENEXT);
        data.writeUInt16LE(_comLen, Constants.CENCOM);
        data.writeUInt16LE(_diskStart, Constants.CENDSK);
        data.writeUInt16LE(_inattr, Constants.CENATT);
        data.writeUInt32LE(_attr, Constants.CENATX);
        data.writeUInt32LE(_offset, Constants.CENOFF);
        return data;
      },
      toJSON: function() {
        const bytes = function(nr) {
          return nr + " bytes";
        };
        return {
          made: _verMade,
          version: _version,
          flags: _flags,
          method: Utils.methodToString(_method),
          time: this.time,
          crc: "0x" + _crc.toString(16).toUpperCase(),
          compressedSize: bytes(_compressedSize),
          size: bytes(_size),
          fileNameLength: bytes(_fnameLen),
          extraLength: bytes(_extraLen),
          commentLength: bytes(_comLen),
          diskNumStart: _diskStart,
          inAttr: _inattr,
          attr: _attr,
          offset: _offset,
          centralHeaderSize: bytes(Constants.CENHDR + _fnameLen + _extraLen + _comLen)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  };
  return entryHeader;
}
var mainHeader;
var hasRequiredMainHeader;
function requireMainHeader() {
  if (hasRequiredMainHeader) return mainHeader;
  hasRequiredMainHeader = 1;
  var Utils = requireUtil(), Constants = Utils.Constants;
  mainHeader = function() {
    var _volumeEntries = 0, _totalEntries = 0, _size = 0, _offset = 0, _commentLength = 0;
    const needsZip64 = () => _volumeEntries > Constants.EF_ZIP64_OR_16 || _totalEntries > Constants.EF_ZIP64_OR_16 || _size > Constants.EF_ZIP64_OR_32 || _offset > Constants.EF_ZIP64_OR_32;
    return {
      get diskEntries() {
        return _volumeEntries;
      },
      set diskEntries(val) {
        _volumeEntries = _totalEntries = val;
      },
      get totalEntries() {
        return _totalEntries;
      },
      set totalEntries(val) {
        _totalEntries = _volumeEntries = val;
      },
      get size() {
        return _size;
      },
      set size(val) {
        _size = val;
      },
      get offset() {
        return _offset;
      },
      set offset(val) {
        _offset = val;
      },
      get commentLength() {
        return _commentLength;
      },
      set commentLength(val) {
        _commentLength = val;
      },
      get mainHeaderSize() {
        return (needsZip64() ? Constants.ZIP64HDR + Constants.END64HDR : 0) + Constants.ENDHDR + _commentLength;
      },
      loadFromBinary: function(data) {
        if ((data.length !== Constants.ENDHDR || data.readUInt32LE(0) !== Constants.ENDSIG) && (data.length < Constants.ZIP64HDR || data.readUInt32LE(0) !== Constants.ZIP64SIG)) {
          throw Utils.Errors.INVALID_END();
        }
        if (data.readUInt32LE(0) === Constants.ENDSIG) {
          _volumeEntries = data.readUInt16LE(Constants.ENDSUB);
          _totalEntries = data.readUInt16LE(Constants.ENDTOT);
          _size = data.readUInt32LE(Constants.ENDSIZ);
          _offset = data.readUInt32LE(Constants.ENDOFF);
          _commentLength = data.readUInt16LE(Constants.ENDCOM);
        } else {
          _volumeEntries = Utils.readBigUInt64LE(data, Constants.ZIP64SUB);
          _totalEntries = Utils.readBigUInt64LE(data, Constants.ZIP64TOT);
          _size = Utils.readBigUInt64LE(data, Constants.ZIP64SIZB);
          _offset = Utils.readBigUInt64LE(data, Constants.ZIP64OFF);
          _commentLength = 0;
        }
      },
      toBinary: function() {
        if (!needsZip64()) {
          var b = Buffer.alloc(Constants.ENDHDR + _commentLength);
          b.writeUInt32LE(Constants.ENDSIG, 0);
          b.writeUInt32LE(0, 4);
          b.writeUInt16LE(_volumeEntries, Constants.ENDSUB);
          b.writeUInt16LE(_totalEntries, Constants.ENDTOT);
          b.writeUInt32LE(_size, Constants.ENDSIZ);
          b.writeUInt32LE(_offset, Constants.ENDOFF);
          b.writeUInt16LE(_commentLength, Constants.ENDCOM);
          b.fill(" ", Constants.ENDHDR);
          return b;
        }
        var b = Buffer.alloc(this.mainHeaderSize);
        let offset = 0;
        b.writeUInt32LE(Constants.ZIP64SIG, offset);
        Utils.writeBigUInt64LE(b, Constants.ZIP64HDR - Constants.ZIP64LEAD, offset + Constants.ZIP64SIZE);
        b.writeUInt16LE(45, offset + Constants.ZIP64VEM);
        b.writeUInt16LE(45, offset + Constants.ZIP64VER);
        b.writeUInt32LE(0, offset + Constants.ZIP64DSK);
        b.writeUInt32LE(0, offset + Constants.ZIP64DSKDIR);
        Utils.writeBigUInt64LE(b, _volumeEntries, offset + Constants.ZIP64SUB);
        Utils.writeBigUInt64LE(b, _totalEntries, offset + Constants.ZIP64TOT);
        Utils.writeBigUInt64LE(b, _size, offset + Constants.ZIP64SIZB);
        Utils.writeBigUInt64LE(b, _offset, offset + Constants.ZIP64OFF);
        const zip64EndOffset = _offset + _size;
        offset += Constants.ZIP64HDR;
        b.writeUInt32LE(Constants.END64SIG, offset);
        b.writeUInt32LE(0, offset + Constants.END64START);
        Utils.writeBigUInt64LE(b, zip64EndOffset, offset + Constants.END64OFF);
        b.writeUInt32LE(1, offset + Constants.END64NUMDISKS);
        offset += Constants.END64HDR;
        b.writeUInt32LE(Constants.ENDSIG, offset);
        b.writeUInt32LE(0, offset + 4);
        b.writeUInt16LE(Math.min(_volumeEntries, Constants.EF_ZIP64_OR_16), offset + Constants.ENDSUB);
        b.writeUInt16LE(Math.min(_totalEntries, Constants.EF_ZIP64_OR_16), offset + Constants.ENDTOT);
        b.writeUInt32LE(Math.min(_size, Constants.EF_ZIP64_OR_32), offset + Constants.ENDSIZ);
        b.writeUInt32LE(Math.min(_offset, Constants.EF_ZIP64_OR_32), offset + Constants.ENDOFF);
        b.writeUInt16LE(_commentLength, offset + Constants.ENDCOM);
        b.fill(" ", offset + Constants.ENDHDR);
        return b;
      },
      toJSON: function() {
        const offset = function(nr, len) {
          let offs = nr.toString(16).toUpperCase();
          while (offs.length < len) offs = "0" + offs;
          return "0x" + offs;
        };
        return {
          diskEntries: _volumeEntries,
          totalEntries: _totalEntries,
          size: _size + " bytes",
          offset: offset(_offset, 4),
          commentLength: _commentLength
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  };
  return mainHeader;
}
var hasRequiredHeaders;
function requireHeaders() {
  if (hasRequiredHeaders) return headers;
  hasRequiredHeaders = 1;
  headers.EntryHeader = requireEntryHeader();
  headers.MainHeader = requireMainHeader();
  return headers;
}
var methods = {};
var deflater;
var hasRequiredDeflater;
function requireDeflater() {
  if (hasRequiredDeflater) return deflater;
  hasRequiredDeflater = 1;
  deflater = function(inbuf) {
    var zlib = require$$0;
    var opts = { chunkSize: (parseInt(inbuf.length / 1024) + 1) * 1024 };
    return {
      deflate: function() {
        return zlib.deflateRawSync(inbuf, opts);
      },
      deflateAsync: function(callback) {
        var tmp = zlib.createDeflateRaw(opts), parts = [], total = 0;
        tmp.on("data", function(data) {
          parts.push(data);
          total += data.length;
        });
        tmp.on("end", function() {
          var buf = Buffer.alloc(total), written = 0;
          buf.fill(0);
          for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            part.copy(buf, written);
            written += part.length;
          }
          callback && callback(buf);
        });
        tmp.end(inbuf);
      }
    };
  };
  return deflater;
}
var inflater;
var hasRequiredInflater;
function requireInflater() {
  var _a;
  if (hasRequiredInflater) return inflater;
  hasRequiredInflater = 1;
  const version = +(((_a = process == null ? void 0 : process.versions) == null ? void 0 : _a.node) ?? "").split(".")[0] || 0;
  inflater = function(inbuf, expectedLength) {
    var zlib = require$$0;
    const option = version >= 15 && expectedLength > 0 ? { maxOutputLength: expectedLength } : {};
    return {
      inflate: function() {
        return zlib.inflateRawSync(inbuf, option);
      },
      inflateAsync: function(callback) {
        var tmp = zlib.createInflateRaw(option), parts = [], total = 0;
        tmp.on("data", function(data) {
          parts.push(data);
          total += data.length;
        });
        tmp.on("end", function() {
          var buf = Buffer.alloc(total), written = 0;
          buf.fill(0);
          for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            part.copy(buf, written);
            written += part.length;
          }
          callback && callback(buf);
        });
        tmp.end(inbuf);
      }
    };
  };
  return inflater;
}
var zipcrypto;
var hasRequiredZipcrypto;
function requireZipcrypto() {
  if (hasRequiredZipcrypto) return zipcrypto;
  hasRequiredZipcrypto = 1;
  const { randomFillSync } = require$$0$1;
  const Errors = requireErrors();
  const crctable = new Uint32Array(256).map((t, crc) => {
    for (let j = 0; j < 8; j++) {
      if (0 !== (crc & 1)) {
        crc = crc >>> 1 ^ 3988292384;
      } else {
        crc >>>= 1;
      }
    }
    return crc >>> 0;
  });
  const uMul = (a, b) => Math.imul(a, b) >>> 0;
  const crc32update = (pCrc32, bval) => {
    return crctable[(pCrc32 ^ bval) & 255] ^ pCrc32 >>> 8;
  };
  const genSalt = () => {
    if ("function" === typeof randomFillSync) {
      return randomFillSync(Buffer.alloc(12));
    } else {
      return genSalt.node();
    }
  };
  genSalt.node = () => {
    const salt = Buffer.alloc(12);
    const len = salt.length;
    for (let i = 0; i < len; i++) salt[i] = Math.random() * 256 & 255;
    return salt;
  };
  const config = {
    genSalt
  };
  function Initkeys(pw) {
    const pass = Buffer.isBuffer(pw) ? pw : Buffer.from(pw);
    this.keys = new Uint32Array([305419896, 591751049, 878082192]);
    for (let i = 0; i < pass.length; i++) {
      this.updateKeys(pass[i]);
    }
  }
  Initkeys.prototype.updateKeys = function(byteValue) {
    const keys = this.keys;
    keys[0] = crc32update(keys[0], byteValue);
    keys[1] += keys[0] & 255;
    keys[1] = uMul(keys[1], 134775813) + 1;
    keys[2] = crc32update(keys[2], keys[1] >>> 24);
    return byteValue;
  };
  Initkeys.prototype.next = function() {
    const k = (this.keys[2] | 2) >>> 0;
    return uMul(k, k ^ 1) >> 8 & 255;
  };
  function make_decrypter(pwd) {
    const keys = new Initkeys(pwd);
    return function(data) {
      const result = Buffer.alloc(data.length);
      let pos = 0;
      for (let c of data) {
        result[pos++] = keys.updateKeys(c ^ keys.next());
      }
      return result;
    };
  }
  function make_encrypter(pwd) {
    const keys = new Initkeys(pwd);
    return function(data, result, pos = 0) {
      if (!result) result = Buffer.alloc(data.length);
      for (let c of data) {
        const k = keys.next();
        result[pos++] = c ^ k;
        keys.updateKeys(c);
      }
      return result;
    };
  }
  function decrypt(data, header, pwd) {
    if (!data || !Buffer.isBuffer(data) || data.length < 12) {
      return Buffer.alloc(0);
    }
    const decrypter = make_decrypter(pwd);
    const salt = decrypter(data.slice(0, 12));
    const verifyByte = (header.flags & 8) === 8 ? header.timeHighByte : header.crc >>> 24;
    if (salt[11] !== verifyByte) {
      throw Errors.WRONG_PASSWORD();
    }
    return decrypter(data.slice(12));
  }
  function _salter(data) {
    if (Buffer.isBuffer(data) && data.length >= 12) {
      config.genSalt = function() {
        return data.slice(0, 12);
      };
    } else if (data === "node") {
      config.genSalt = genSalt.node;
    } else {
      config.genSalt = genSalt;
    }
  }
  function encrypt(data, header, pwd, oldlike = false) {
    if (data == null) data = Buffer.alloc(0);
    if (!Buffer.isBuffer(data)) data = Buffer.from(data.toString());
    const encrypter = make_encrypter(pwd);
    const salt = config.genSalt();
    salt[11] = header.crc >>> 24 & 255;
    if (oldlike) salt[10] = header.crc >>> 16 & 255;
    const result = Buffer.alloc(data.length + 12);
    encrypter(salt, result);
    return encrypter(data, result, 12);
  }
  zipcrypto = { decrypt, encrypt, _salter };
  return zipcrypto;
}
var hasRequiredMethods;
function requireMethods() {
  if (hasRequiredMethods) return methods;
  hasRequiredMethods = 1;
  methods.Deflater = requireDeflater();
  methods.Inflater = requireInflater();
  methods.ZipCrypto = requireZipcrypto();
  return methods;
}
var zipEntry;
var hasRequiredZipEntry;
function requireZipEntry() {
  if (hasRequiredZipEntry) return zipEntry;
  hasRequiredZipEntry = 1;
  var Utils = requireUtil(), Headers = requireHeaders(), Constants = Utils.Constants, Methods = requireMethods();
  zipEntry = function(options, input) {
    var _centralHeader = new Headers.EntryHeader(), _entryName = Buffer.alloc(0), _comment = Buffer.alloc(0), _isDirectory = false, uncompressedData = null, _extra = Buffer.alloc(0), _extralocal = Buffer.alloc(0), _efs = true;
    const opts = options;
    const decoder2 = typeof opts.decoder === "object" ? opts.decoder : Utils.decoder;
    _efs = decoder2.hasOwnProperty("efs") ? decoder2.efs : false;
    function getCompressedDataFromZip() {
      if (!input || !(input instanceof Uint8Array)) {
        return Buffer.alloc(0);
      }
      _extralocal = _centralHeader.loadLocalHeaderFromBinary(input);
      return input.slice(_centralHeader.realDataOffset, _centralHeader.realDataOffset + _centralHeader.compressedSize);
    }
    function crc32OK(data) {
      const expectedCrc = _centralHeader.flags_desc || _centralHeader.localHeader.flags_desc ? _centralHeader.crc : _centralHeader.localHeader.crc;
      return Utils.crc32(data) === expectedCrc;
    }
    function decompress(async, callback, pass) {
      if (typeof callback === "undefined" && typeof async === "string") {
        pass = async;
        async = void 0;
      }
      if (_isDirectory) {
        if (async && callback) {
          callback(Buffer.alloc(0), Utils.Errors.DIRECTORY_CONTENT_ERROR());
        }
        return Buffer.alloc(0);
      }
      var compressedData = getCompressedDataFromZip();
      if (compressedData.length === 0) {
        if (async && callback) callback(compressedData);
        return compressedData;
      }
      if (_centralHeader.encrypted) {
        if ("string" !== typeof pass && !Buffer.isBuffer(pass)) {
          throw Utils.Errors.INVALID_PASS_PARAM();
        }
        compressedData = Methods.ZipCrypto.decrypt(compressedData, _centralHeader, pass);
      }
      var data;
      switch (_centralHeader.method) {
        case Utils.Constants.STORED:
          data = Buffer.alloc(compressedData.length);
          compressedData.copy(data);
          if (!crc32OK(data)) {
            if (async && callback) callback(data, Utils.Errors.BAD_CRC());
            throw Utils.Errors.BAD_CRC();
          } else {
            if (async && callback) callback(data);
            return data;
          }
        case Utils.Constants.DEFLATED:
          var inflater2 = new Methods.Inflater(compressedData, _centralHeader.size);
          if (!async) {
            data = inflater2.inflate();
            if (!crc32OK(data)) {
              throw Utils.Errors.BAD_CRC(`"${decoder2.decode(_entryName)}"`);
            }
            return data;
          } else {
            inflater2.inflateAsync(function(result) {
              if (callback) {
                if (!crc32OK(result)) {
                  callback(result, Utils.Errors.BAD_CRC());
                } else {
                  callback(result);
                }
              }
            });
          }
          break;
        default:
          if (async && callback) callback(Buffer.alloc(0), Utils.Errors.UNKNOWN_METHOD());
          throw Utils.Errors.UNKNOWN_METHOD();
      }
    }
    function compress(async, callback) {
      if ((!uncompressedData || !uncompressedData.length) && Buffer.isBuffer(input)) {
        if (async && callback) callback(getCompressedDataFromZip());
        return getCompressedDataFromZip();
      }
      if (uncompressedData.length && !_isDirectory) {
        var compressedData;
        switch (_centralHeader.method) {
          case Utils.Constants.STORED:
            _centralHeader.compressedSize = _centralHeader.size;
            compressedData = Buffer.alloc(uncompressedData.length);
            uncompressedData.copy(compressedData);
            if (async && callback) callback(compressedData);
            return compressedData;
          default:
          case Utils.Constants.DEFLATED:
            var deflater2 = new Methods.Deflater(uncompressedData);
            if (!async) {
              var deflated = deflater2.deflate();
              _centralHeader.compressedSize = deflated.length;
              return deflated;
            } else {
              deflater2.deflateAsync(function(data) {
                compressedData = Buffer.alloc(data.length);
                _centralHeader.compressedSize = data.length;
                data.copy(compressedData);
                callback && callback(compressedData);
              });
            }
            deflater2 = null;
            break;
        }
      } else if (async && callback) {
        callback(Buffer.alloc(0));
      } else {
        return Buffer.alloc(0);
      }
    }
    function readUInt64LE(buffer, offset) {
      return Utils.readBigUInt64LE(buffer, offset);
    }
    function parseExtra(data) {
      try {
        var offset = 0;
        var signature, size, part;
        while (offset + 4 < data.length) {
          signature = data.readUInt16LE(offset);
          offset += 2;
          size = data.readUInt16LE(offset);
          offset += 2;
          part = data.slice(offset, offset + size);
          offset += size;
          if (Constants.ID_ZIP64 === signature) {
            parseZip64ExtendedInformation(part);
          }
        }
      } catch (error) {
        throw Utils.Errors.EXTRA_FIELD_PARSE_ERROR();
      }
    }
    function parseZip64ExtendedInformation(data) {
      var size, compressedSize, offset, diskNumStart;
      if (data.length >= Constants.EF_ZIP64_SCOMP) {
        size = readUInt64LE(data, Constants.EF_ZIP64_SUNCOMP);
        if (_centralHeader.size === Constants.EF_ZIP64_OR_32) {
          _centralHeader.size = size;
        }
      }
      if (data.length >= Constants.EF_ZIP64_RHO) {
        compressedSize = readUInt64LE(data, Constants.EF_ZIP64_SCOMP);
        if (_centralHeader.compressedSize === Constants.EF_ZIP64_OR_32) {
          _centralHeader.compressedSize = compressedSize;
        }
      }
      if (data.length >= Constants.EF_ZIP64_DSN) {
        offset = readUInt64LE(data, Constants.EF_ZIP64_RHO);
        if (_centralHeader.offset === Constants.EF_ZIP64_OR_32) {
          _centralHeader.offset = offset;
        }
      }
      if (data.length >= Constants.EF_ZIP64_DSN + 4) {
        diskNumStart = data.readUInt32LE(Constants.EF_ZIP64_DSN);
        if (_centralHeader.diskNumStart === Constants.EF_ZIP64_OR_16) {
          _centralHeader.diskNumStart = diskNumStart;
        }
      }
    }
    return {
      get entryName() {
        return decoder2.decode(_entryName);
      },
      get rawEntryName() {
        return _entryName;
      },
      set entryName(val) {
        _entryName = Utils.toBuffer(val, decoder2.encode);
        var lastChar = _entryName[_entryName.length - 1];
        _isDirectory = lastChar === 47 || lastChar === 92;
        _centralHeader.fileNameLength = _entryName.length;
      },
      get efs() {
        if (typeof _efs === "function") {
          return _efs(this.entryName);
        } else {
          return _efs;
        }
      },
      get extra() {
        return _extra;
      },
      set extra(val) {
        _extra = val;
        _centralHeader.extraLength = val.length;
        parseExtra(val);
      },
      get comment() {
        return decoder2.decode(_comment);
      },
      set comment(val) {
        _comment = Utils.toBuffer(val, decoder2.encode);
        _centralHeader.commentLength = _comment.length;
        if (_comment.length > 65535) throw Utils.Errors.COMMENT_TOO_LONG();
      },
      get name() {
        const n = decoder2.decode(_entryName);
        return _isDirectory ? n.replace(/[/\\]$/, "").split("/").pop() : n.split("/").pop();
      },
      get isDirectory() {
        return _isDirectory;
      },
      getCompressedData: function() {
        return compress(false, null);
      },
      getCompressedDataAsync: function(callback) {
        compress(true, callback);
      },
      setData: function(value) {
        uncompressedData = Utils.toBuffer(value, Utils.decoder.encode);
        if (!_isDirectory && uncompressedData.length) {
          _centralHeader.size = uncompressedData.length;
          _centralHeader.method = Utils.Constants.DEFLATED;
          _centralHeader.crc = Utils.crc32(value);
          _centralHeader.changed = true;
        } else {
          _centralHeader.method = Utils.Constants.STORED;
        }
      },
      getData: function(pass) {
        if (_centralHeader.changed) {
          return uncompressedData;
        } else {
          return decompress(false, null, pass);
        }
      },
      getDataAsync: function(callback, pass) {
        if (_centralHeader.changed) {
          callback(uncompressedData);
        } else {
          decompress(true, callback, pass);
        }
      },
      set attr(attr) {
        _centralHeader.attr = attr;
      },
      get attr() {
        return _centralHeader.attr;
      },
      set header(data) {
        _centralHeader.loadFromBinary(data);
      },
      get header() {
        return _centralHeader;
      },
      packCentralHeader: function() {
        _centralHeader.flags_efs = this.efs;
        _centralHeader.extraLength = _extra.length;
        var header = _centralHeader.centralHeaderToBinary();
        var addpos = Utils.Constants.CENHDR;
        _entryName.copy(header, addpos);
        addpos += _entryName.length;
        _extra.copy(header, addpos);
        addpos += _centralHeader.extraLength;
        _comment.copy(header, addpos);
        return header;
      },
      packLocalHeader: function() {
        let addpos = 0;
        _centralHeader.flags_efs = this.efs;
        _centralHeader.extraLocalLength = _extralocal.length;
        const localHeaderBuf = _centralHeader.localHeaderToBinary();
        const localHeader = Buffer.alloc(localHeaderBuf.length + _entryName.length + _centralHeader.extraLocalLength);
        localHeaderBuf.copy(localHeader, addpos);
        addpos += localHeaderBuf.length;
        _entryName.copy(localHeader, addpos);
        addpos += _entryName.length;
        _extralocal.copy(localHeader, addpos);
        addpos += _extralocal.length;
        return localHeader;
      },
      toJSON: function() {
        const bytes = function(nr) {
          return "<" + (nr && nr.length + " bytes buffer" || "null") + ">";
        };
        return {
          entryName: this.entryName,
          name: this.name,
          comment: this.comment,
          isDirectory: this.isDirectory,
          header: _centralHeader.toJSON(),
          compressedData: bytes(input),
          data: bytes(uncompressedData)
        };
      },
      toString: function() {
        return JSON.stringify(this.toJSON(), null, "	");
      }
    };
  };
  return zipEntry;
}
var zipFile;
var hasRequiredZipFile;
function requireZipFile() {
  if (hasRequiredZipFile) return zipFile;
  hasRequiredZipFile = 1;
  const ZipEntry = requireZipEntry();
  const Headers = requireHeaders();
  const Utils = requireUtil();
  zipFile = function(inBuffer, options) {
    var entryList = [], entryTable = /* @__PURE__ */ Object.create(null), _comment = Buffer.alloc(0), mainHeader2 = new Headers.MainHeader(), loadedEntries = false;
    const temporary = /* @__PURE__ */ new Set();
    const opts = options;
    const { noSort, decoder: decoder2 } = opts;
    if (inBuffer) {
      readMainHeader(opts.readEntries);
    } else {
      loadedEntries = true;
    }
    function makeTemporaryFolders() {
      const foldersList = /* @__PURE__ */ new Set();
      for (const elem of Object.keys(entryTable)) {
        const elements = elem.split("/");
        elements.pop();
        if (!elements.length) continue;
        for (let i = 0; i < elements.length; i++) {
          const sub = elements.slice(0, i + 1).join("/") + "/";
          foldersList.add(sub);
        }
      }
      for (const elem of foldersList) {
        if (!(elem in entryTable)) {
          const tempfolder = new ZipEntry(opts);
          tempfolder.entryName = elem;
          tempfolder.attr = 16;
          tempfolder.temporary = true;
          entryList.push(tempfolder);
          entryTable[tempfolder.entryName] = tempfolder;
          temporary.add(tempfolder);
        }
      }
    }
    function readEntries() {
      loadedEntries = true;
      entryTable = /* @__PURE__ */ Object.create(null);
      if (mainHeader2.diskEntries > (inBuffer.length - mainHeader2.offset) / Utils.Constants.CENHDR) {
        throw Utils.Errors.DISK_ENTRY_TOO_LARGE();
      }
      entryList = new Array(mainHeader2.diskEntries);
      var index = mainHeader2.offset;
      for (var i = 0; i < entryList.length; i++) {
        var tmp = index, entry = new ZipEntry(opts, inBuffer);
        entry.header = inBuffer.slice(tmp, tmp += Utils.Constants.CENHDR);
        entry.entryName = inBuffer.slice(tmp, tmp += entry.header.fileNameLength);
        if (entry.header.extraLength) {
          entry.extra = inBuffer.slice(tmp, tmp += entry.header.extraLength);
        }
        if (entry.header.commentLength) entry.comment = inBuffer.slice(tmp, tmp + entry.header.commentLength);
        index += entry.header.centralHeaderSize;
        entryList[i] = entry;
        entryTable[entry.entryName] = entry;
      }
      temporary.clear();
      makeTemporaryFolders();
    }
    function readMainHeader(readNow) {
      var i = inBuffer.length - Utils.Constants.ENDHDR, max = Math.max(0, i - 65535), n = max, endStart = inBuffer.length, endOffset = -1, commentEnd = 0;
      const trailingSpace = typeof opts.trailingSpace === "boolean" ? opts.trailingSpace : false;
      if (trailingSpace) max = 0;
      for (i; i >= n; i--) {
        if (inBuffer[i] !== 80) continue;
        if (inBuffer.readUInt32LE(i) === Utils.Constants.ENDSIG) {
          endOffset = i;
          commentEnd = i;
          endStart = i + Utils.Constants.ENDHDR;
          n = i - Utils.Constants.END64HDR;
          continue;
        }
        if (inBuffer.readUInt32LE(i) === Utils.Constants.END64SIG) {
          n = max;
          continue;
        }
        if (inBuffer.readUInt32LE(i) === Utils.Constants.ZIP64SIG) {
          endOffset = i;
          endStart = i + Utils.readBigUInt64LE(inBuffer, i + Utils.Constants.ZIP64SIZE) + Utils.Constants.ZIP64LEAD;
          break;
        }
      }
      if (endOffset == -1) throw Utils.Errors.INVALID_FORMAT();
      mainHeader2.loadFromBinary(inBuffer.slice(endOffset, endStart));
      if (mainHeader2.commentLength) {
        _comment = inBuffer.slice(commentEnd + Utils.Constants.ENDHDR);
      }
      if (readNow) readEntries();
    }
    function sortEntries() {
      if (entryList.length > 1 && !noSort) {
        entryList = entryList.map((entry) => ({ entry, key: entry.entryName.toLowerCase() })).sort((a, b) => a.key.localeCompare(b.key)).map((pair) => pair.entry);
      }
    }
    return {
      /**
       * Returns an array of ZipEntry objects existent in the current opened archive
       * @return Array
       */
      get entries() {
        if (!loadedEntries) {
          readEntries();
        }
        return entryList.filter((e) => !temporary.has(e));
      },
      /**
       * Archive comment
       * @return {String}
       */
      get comment() {
        return decoder2.decode(_comment);
      },
      set comment(val) {
        _comment = Utils.toBuffer(val, decoder2.encode);
        mainHeader2.commentLength = _comment.length;
      },
      getEntryCount: function() {
        if (!loadedEntries) {
          return mainHeader2.diskEntries;
        }
        return entryList.length;
      },
      forEach: function(callback) {
        this.entries.forEach(callback);
      },
      /**
       * Returns a reference to the entry with the given name or null if entry is inexistent
       *
       * @param entryName
       * @return ZipEntry
       */
      getEntry: function(entryName) {
        if (!loadedEntries) {
          readEntries();
        }
        return entryTable[entryName] || null;
      },
      /**
       * Adds the given entry to the entry list
       *
       * @param entry
       */
      setEntry: function(entry) {
        if (!loadedEntries) {
          readEntries();
        }
        entryList.push(entry);
        entryTable[entry.entryName] = entry;
        mainHeader2.totalEntries = entryList.length;
      },
      /**
       * Removes the file with the given name from the entry list.
       *
       * If the entry is a directory, then all nested files and directories will be removed
       * @param entryName
       * @returns {void}
       */
      deleteFile: function(entryName, withsubfolders = true) {
        if (!loadedEntries) {
          readEntries();
        }
        const entry = entryTable[entryName];
        const list = this.getEntryChildren(entry, withsubfolders).map((child) => child.entryName);
        list.forEach(this.deleteEntry);
      },
      /**
       * Removes the entry with the given name from the entry list.
       *
       * @param {string} entryName
       * @returns {void}
       */
      deleteEntry: function(entryName) {
        if (!loadedEntries) {
          readEntries();
        }
        const entry = entryTable[entryName];
        const index = entryList.indexOf(entry);
        if (index >= 0) {
          entryList.splice(index, 1);
          delete entryTable[entryName];
          mainHeader2.totalEntries = entryList.length;
        }
      },
      /**
       *  Iterates and returns all nested files and directories of the given entry
       *
       * @param entry
       * @return Array
       */
      getEntryChildren: function(entry, subfolders = true) {
        if (!loadedEntries) {
          readEntries();
        }
        if (typeof entry === "object") {
          if (entry.isDirectory && subfolders) {
            const list = [];
            const name = entry.entryName;
            for (const zipEntry2 of entryList) {
              if (zipEntry2.entryName.startsWith(name)) {
                list.push(zipEntry2);
              }
            }
            return list;
          } else {
            return [entry];
          }
        }
        return [];
      },
      /**
       *  How many child elements entry has
       *
       * @param {ZipEntry} entry
       * @return {integer}
       */
      getChildCount: function(entry) {
        if (entry && entry.isDirectory) {
          const list = this.getEntryChildren(entry);
          return list.includes(entry) ? list.length - 1 : list.length;
        }
        return 0;
      },
      /**
       * Returns the zip file
       *
       * @return Buffer
       */
      compressToBuffer: function() {
        if (!loadedEntries) {
          readEntries();
        }
        sortEntries();
        const dataBlock = [];
        const headerBlocks = [];
        let totalSize = 0;
        let dindex = 0;
        mainHeader2.size = 0;
        mainHeader2.offset = 0;
        let totalEntries = 0;
        for (const entry of this.entries) {
          const compressedData = entry.getCompressedData();
          entry.header.offset = dindex;
          const localHeader = entry.packLocalHeader();
          const dataLength = localHeader.length + compressedData.length;
          dindex += dataLength;
          dataBlock.push(localHeader);
          dataBlock.push(compressedData);
          const centralHeader = entry.packCentralHeader();
          headerBlocks.push(centralHeader);
          mainHeader2.size += centralHeader.length;
          totalSize += dataLength + centralHeader.length;
          totalEntries++;
        }
        totalSize += mainHeader2.mainHeaderSize;
        mainHeader2.offset = dindex;
        mainHeader2.totalEntries = totalEntries;
        dindex = 0;
        const outBuffer = Buffer.alloc(totalSize);
        for (const content of dataBlock) {
          content.copy(outBuffer, dindex);
          dindex += content.length;
        }
        for (const content of headerBlocks) {
          content.copy(outBuffer, dindex);
          dindex += content.length;
        }
        const mh = mainHeader2.toBinary();
        if (_comment) {
          _comment.copy(mh, mh.length - _comment.length);
        }
        mh.copy(outBuffer, dindex);
        inBuffer = outBuffer;
        loadedEntries = false;
        return outBuffer;
      },
      toAsyncBuffer: function(onSuccess, onFail, onItemStart, onItemEnd) {
        try {
          if (!loadedEntries) {
            readEntries();
          }
          sortEntries();
          const dataBlock = [];
          const centralHeaders = [];
          let totalSize = 0;
          let dindex = 0;
          let totalEntries = 0;
          mainHeader2.size = 0;
          mainHeader2.offset = 0;
          const compress2Buffer = function(entryLists) {
            if (entryLists.length > 0) {
              const entry = entryLists.shift();
              const name = entry.entryName + entry.extra.toString();
              if (onItemStart) onItemStart(name);
              entry.getCompressedDataAsync(function(compressedData) {
                if (onItemEnd) onItemEnd(name);
                entry.header.offset = dindex;
                const localHeader = entry.packLocalHeader();
                const dataLength = localHeader.length + compressedData.length;
                dindex += dataLength;
                dataBlock.push(localHeader);
                dataBlock.push(compressedData);
                const centalHeader = entry.packCentralHeader();
                centralHeaders.push(centalHeader);
                mainHeader2.size += centalHeader.length;
                totalSize += dataLength + centalHeader.length;
                totalEntries++;
                compress2Buffer(entryLists);
              });
            } else {
              totalSize += mainHeader2.mainHeaderSize;
              mainHeader2.offset = dindex;
              mainHeader2.totalEntries = totalEntries;
              dindex = 0;
              const outBuffer = Buffer.alloc(totalSize);
              dataBlock.forEach(function(content) {
                content.copy(outBuffer, dindex);
                dindex += content.length;
              });
              centralHeaders.forEach(function(content) {
                content.copy(outBuffer, dindex);
                dindex += content.length;
              });
              const mh = mainHeader2.toBinary();
              if (_comment) {
                _comment.copy(mh, mh.length - _comment.length);
              }
              mh.copy(outBuffer, dindex);
              inBuffer = outBuffer;
              loadedEntries = false;
              onSuccess(outBuffer);
            }
          };
          compress2Buffer(Array.from(this.entries));
        } catch (e) {
          onFail(e);
        }
      }
    };
  };
  return zipFile;
}
var admZip;
var hasRequiredAdmZip;
function requireAdmZip() {
  if (hasRequiredAdmZip) return admZip;
  hasRequiredAdmZip = 1;
  const Utils = requireUtil();
  const pth = path;
  const ZipEntry = requireZipEntry();
  const ZipFile = requireZipFile();
  const get_Bool = (...val) => Utils.findLast(val, (c) => typeof c === "boolean");
  const get_Str = (...val) => Utils.findLast(val, (c) => typeof c === "string");
  const get_Fun = (...val) => Utils.findLast(val, (c) => typeof c === "function");
  const defaultOptions = {
    // option "noSort" : if true it disables files sorting
    noSort: false,
    // read entries during load (initial loading may be slower)
    readEntries: false,
    // default method is none
    method: Utils.Constants.NONE,
    // file system
    fs: null
  };
  admZip = function(input, options) {
    let inBuffer = null;
    const opts = Object.assign(/* @__PURE__ */ Object.create(null), defaultOptions);
    if (input && "object" === typeof input) {
      if (!(input instanceof Uint8Array)) {
        Object.assign(opts, input);
        input = opts.input ? opts.input : void 0;
        if (opts.input) delete opts.input;
      }
      if (Buffer.isBuffer(input)) {
        inBuffer = input;
        opts.method = Utils.Constants.BUFFER;
        input = void 0;
      }
    }
    Object.assign(opts, options);
    const filetools = new Utils(opts);
    const applyDirAttributes = (dirEntries) => {
      dirEntries.filter((d) => d.attr).sort((a, b) => b.path.length - a.path.length).forEach((d) => filetools.fs.chmodSync(d.path, d.attr));
    };
    if (typeof opts.decoder !== "object" || typeof opts.decoder.encode !== "function" || typeof opts.decoder.decode !== "function") {
      opts.decoder = Utils.decoder;
    }
    if (input && "string" === typeof input) {
      if (filetools.fs.existsSync(input)) {
        opts.method = Utils.Constants.FILE;
        opts.filename = input;
        inBuffer = filetools.fs.readFileSync(input);
      } else {
        throw Utils.Errors.INVALID_FILENAME();
      }
    }
    const _zip = new ZipFile(inBuffer, opts);
    const { canonical, sanitize, zipnamefix } = Utils;
    function getEntry(entry) {
      if (entry && _zip) {
        var item;
        if (typeof entry === "string") item = _zip.getEntry(pth.posix.normalize(entry));
        if (typeof entry === "object" && typeof entry.entryName !== "undefined" && typeof entry.header !== "undefined") item = _zip.getEntry(entry.entryName);
        if (item) {
          return item;
        }
      }
      return null;
    }
    function fixPath(zipPath) {
      const { join, normalize, sep } = pth.posix;
      return join(pth.isAbsolute(zipPath) ? "/" : ".", normalize(sep + zipPath.split("\\").join(sep) + sep));
    }
    function filenameFilter(filterfn) {
      if (filterfn instanceof RegExp) {
        return /* @__PURE__ */ (function(rx) {
          return function(filename) {
            return rx.test(filename);
          };
        })(filterfn);
      } else if ("function" !== typeof filterfn) {
        return () => true;
      }
      return filterfn;
    }
    const relativePath = (local, entry) => {
      let lastChar = entry.slice(-1);
      lastChar = lastChar === filetools.sep ? filetools.sep : "";
      return pth.relative(local, entry) + lastChar;
    };
    return {
      /**
       * Extracts the given entry from the archive and returns the content as a Buffer object
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {Buffer|string} [pass] - password
       * @return Buffer or Null in case of error
       */
      readFile: function(entry, pass) {
        var item = getEntry(entry);
        return item && item.getData(pass) || null;
      },
      /**
       * Returns how many child elements has on entry (directories) on files it is always 0
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @returns {integer}
       */
      childCount: function(entry) {
        const item = getEntry(entry);
        if (item) {
          return _zip.getChildCount(item);
        }
      },
      /**
       * Asynchronous readFile
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {callback} callback
       *
       * @return Buffer or Null in case of error
       */
      readFileAsync: function(entry, callback) {
        var item = getEntry(entry);
        if (item) {
          item.getDataAsync(callback);
        } else {
          callback(null, "getEntry failed for:" + entry);
        }
      },
      /**
       * Extracts the given entry from the archive and returns the content as plain text in the given encoding
       * @param {ZipEntry|string} entry - ZipEntry object or String with the full path of the entry
       * @param {string} encoding - Optional. If no encoding is specified utf8 is used
       *
       * @return String
       */
      readAsText: function(entry, encoding) {
        var item = getEntry(entry);
        if (item) {
          var data = item.getData();
          if (data && data.length) {
            return data.toString(encoding || "utf8");
          }
        }
        return "";
      },
      /**
       * Asynchronous readAsText
       * @param {ZipEntry|string} entry ZipEntry object or String with the full path of the entry
       * @param {callback} callback
       * @param {string} [encoding] - Optional. If no encoding is specified utf8 is used
       *
       * @return String
       */
      readAsTextAsync: function(entry, callback, encoding) {
        var item = getEntry(entry);
        if (item) {
          item.getDataAsync(function(data, err) {
            if (err) {
              callback(data, err);
              return;
            }
            if (data && data.length) {
              callback(data.toString(encoding || "utf8"));
            } else {
              callback("");
            }
          });
        } else {
          callback("");
        }
      },
      /**
       * Remove the entry from the file or the entry and all it's nested directories and files if the given entry is a directory
       *
       * @param {ZipEntry|string} entry
       * @param {boolean} withsubfolders
       * @returns {void}
       */
      deleteFile: function(entry, withsubfolders = true) {
        var item = getEntry(entry);
        if (item) {
          _zip.deleteFile(item.entryName, withsubfolders);
        }
      },
      /**
       * Remove the entry from the file or directory without affecting any nested entries
       *
       * @param {ZipEntry|string} entry
       * @returns {void}
       */
      deleteEntry: function(entry) {
        var item = getEntry(entry);
        if (item) {
          _zip.deleteEntry(item.entryName);
        }
      },
      /**
       * Adds a comment to the zip. The zip must be rewritten after adding the comment.
       *
       * @param {string} comment
       */
      addZipComment: function(comment) {
        _zip.comment = comment;
      },
      /**
       * Returns the zip comment
       *
       * @return String
       */
      getZipComment: function() {
        return _zip.comment || "";
      },
      /**
       * Adds a comment to a specified zipEntry. The zip must be rewritten after adding the comment
       * The comment cannot exceed 65535 characters in length
       *
       * @param {ZipEntry} entry
       * @param {string} comment
       */
      addZipEntryComment: function(entry, comment) {
        var item = getEntry(entry);
        if (item) {
          item.comment = comment;
        }
      },
      /**
       * Returns the comment of the specified entry
       *
       * @param {ZipEntry} entry
       * @return String
       */
      getZipEntryComment: function(entry) {
        var item = getEntry(entry);
        if (item) {
          return item.comment || "";
        }
        return "";
      },
      /**
       * Updates the content of an existing entry inside the archive. The zip must be rewritten after updating the content
       *
       * @param {ZipEntry} entry
       * @param {Buffer} content
       */
      updateFile: function(entry, content) {
        var item = getEntry(entry);
        if (item) {
          item.setData(content);
        }
      },
      /**
       * Adds a file from the disk to the archive
       *
       * @param {string} localPath File to add to zip
       * @param {string} [zipPath] Optional path inside the zip
       * @param {string} [zipName] Optional name for the file
       * @param {string} [comment] Optional file comment
       */
      addLocalFile: function(localPath, zipPath, zipName, comment) {
        if (filetools.fs.existsSync(localPath)) {
          zipPath = zipPath ? fixPath(zipPath) : "";
          const p = pth.win32.basename(pth.win32.normalize(localPath));
          zipPath += zipName ? zipName : p;
          const _attr = filetools.fs.statSync(localPath);
          const data = _attr.isFile() ? filetools.fs.readFileSync(localPath) : Buffer.alloc(0);
          if (_attr.isDirectory()) zipPath += filetools.sep;
          this.addFile(zipPath, data, comment, _attr);
        } else {
          throw Utils.Errors.FILE_NOT_FOUND(localPath);
        }
      },
      /**
       * Callback for showing if everything was done.
       *
       * @callback doneCallback
       * @param {Error} err - Error object
       * @param {boolean} done - was request fully completed
       */
      /**
       * Adds a file from the disk to the archive
       *
       * @param {(object|string)} options - options object, if it is string it us used as localPath.
       * @param {string} options.localPath - Local path to the file.
       * @param {string} [options.comment] - Optional file comment.
       * @param {string} [options.zipPath] - Optional path inside the zip
       * @param {string} [options.zipName] - Optional name for the file
       * @param {doneCallback} callback - The callback that handles the response.
       */
      addLocalFileAsync: function(options2, callback) {
        options2 = typeof options2 === "object" ? options2 : { localPath: options2 };
        const localPath = pth.resolve(options2.localPath);
        const { comment } = options2;
        let { zipPath, zipName } = options2;
        const self = this;
        filetools.fs.stat(localPath, function(err, stats) {
          if (err) return callback(err, false);
          zipPath = zipPath ? fixPath(zipPath) : "";
          const p = pth.win32.basename(pth.win32.normalize(localPath));
          zipPath += zipName ? zipName : p;
          if (stats.isFile()) {
            filetools.fs.readFile(localPath, function(err2, data) {
              if (err2) return callback(err2, false);
              self.addFile(zipPath, data, comment, stats);
              return setImmediate(callback, void 0, true);
            });
          } else if (stats.isDirectory()) {
            zipPath += filetools.sep;
            self.addFile(zipPath, Buffer.alloc(0), comment, stats);
            return setImmediate(callback, void 0, true);
          }
        });
      },
      /**
       * Adds a local directory and all its nested files and directories to the archive
       *
       * @param {string} localPath - local path to the folder
       * @param {string} [zipPath] - optional path inside zip
       * @param {(RegExp|function)} [filter] - optional RegExp or Function if files match will be included.
       */
      addLocalFolder: function(localPath, zipPath, filter) {
        filter = filenameFilter(filter);
        zipPath = zipPath ? fixPath(zipPath) : "";
        localPath = pth.normalize(localPath);
        if (filetools.fs.existsSync(localPath)) {
          const items = filetools.findFiles(localPath);
          const self = this;
          if (items.length) {
            for (const filepath of items) {
              const p = pth.join(zipPath, relativePath(localPath, filepath));
              if (filter(p)) {
                self.addLocalFile(filepath, pth.dirname(p));
              }
            }
          }
        } else {
          throw Utils.Errors.FILE_NOT_FOUND(localPath);
        }
      },
      /**
       * Asynchronous addLocalFolder
       * @param {string} localPath
       * @param {callback} callback
       * @param {string} [zipPath] optional path inside zip
       * @param {RegExp|function} [filter] optional RegExp or Function if files match will
       *               be included.
       */
      addLocalFolderAsync: function(localPath, callback, zipPath, filter) {
        filter = filenameFilter(filter);
        zipPath = zipPath ? fixPath(zipPath) : "";
        localPath = pth.normalize(localPath);
        var self = this;
        filetools.fs.open(localPath, "r", function(err) {
          if (err && err.code === "ENOENT") {
            callback(void 0, Utils.Errors.FILE_NOT_FOUND(localPath));
          } else if (err) {
            callback(void 0, err);
          } else {
            var items = filetools.findFiles(localPath);
            var i = -1;
            var next = function() {
              i += 1;
              if (i < items.length) {
                var filepath = items[i];
                var p = relativePath(localPath, filepath).split("\\").join("/");
                p = p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
                if (filter(p)) {
                  filetools.fs.stat(filepath, function(er0, stats) {
                    if (er0) callback(void 0, er0);
                    if (stats.isFile()) {
                      filetools.fs.readFile(filepath, function(er1, data) {
                        if (er1) {
                          callback(void 0, er1);
                        } else {
                          self.addFile(zipPath + p, data, "", stats);
                          next();
                        }
                      });
                    } else {
                      self.addFile(zipPath + p + "/", Buffer.alloc(0), "", stats);
                      next();
                    }
                  });
                } else {
                  process.nextTick(() => {
                    next();
                  });
                }
              } else {
                callback(true, void 0);
              }
            };
            next();
          }
        });
      },
      /**
       * Adds a local directory and all its nested files and directories to the archive
       *
       * @param {object | string} options - options object, if it is string it us used as localPath.
       * @param {string} options.localPath - Local path to the folder.
       * @param {string} [options.zipPath] - optional path inside zip.
       * @param {RegExp|function} [options.filter] - optional RegExp or Function if files match will be included.
       * @param {function|string} [options.namefix] - optional function to help fix filename
       * @param {doneCallback} callback - The callback that handles the response.
       *
       */
      addLocalFolderAsync2: function(options2, callback) {
        const self = this;
        options2 = typeof options2 === "object" ? options2 : { localPath: options2 };
        const localPath = pth.resolve(fixPath(options2.localPath));
        let { zipPath, filter, namefix } = options2;
        if (filter instanceof RegExp) {
          filter = /* @__PURE__ */ (function(rx) {
            return function(filename) {
              return rx.test(filename);
            };
          })(filter);
        } else if ("function" !== typeof filter) {
          filter = function() {
            return true;
          };
        }
        zipPath = zipPath ? fixPath(zipPath) : "";
        if (namefix === "latin1") {
          namefix = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
        }
        if (typeof namefix !== "function") namefix = (str) => str;
        const relPathFix = (entry) => pth.join(zipPath, namefix(relativePath(localPath, entry)));
        const fileNameFix = (entry) => pth.win32.basename(pth.win32.normalize(namefix(entry)));
        filetools.fs.open(localPath, "r", function(err) {
          if (err && err.code === "ENOENT") {
            callback(void 0, Utils.Errors.FILE_NOT_FOUND(localPath));
          } else if (err) {
            callback(void 0, err);
          } else {
            filetools.findFilesAsync(localPath, function(err2, fileEntries) {
              if (err2) return callback(err2);
              fileEntries = fileEntries.filter((dir) => filter(relPathFix(dir)));
              if (!fileEntries.length) callback(void 0, false);
              setImmediate(
                fileEntries.reverse().reduce(function(next, entry) {
                  return function(err3, done) {
                    if (err3 || done === false) return setImmediate(next, err3, false);
                    self.addLocalFileAsync(
                      {
                        localPath: entry,
                        zipPath: pth.dirname(relPathFix(entry)),
                        zipName: fileNameFix(entry)
                      },
                      next
                    );
                  };
                }, callback)
              );
            });
          }
        });
      },
      /**
       * Adds a local directory and all its nested files and directories to the archive
       *
       * @param {string} localPath - path where files will be extracted
       * @param {object} props - optional properties
       * @param {string} [props.zipPath] - optional path inside zip
       * @param {RegExp|function} [props.filter] - optional RegExp or Function if files match will be included.
       * @param {function|string} [props.namefix] - optional function to help fix filename
       */
      addLocalFolderPromise: function(localPath, props) {
        return new Promise((resolve, reject) => {
          this.addLocalFolderAsync2(Object.assign({ localPath }, props), (err, done) => {
            if (err) reject(err);
            if (done) resolve(this);
          });
        });
      },
      /**
       * Allows you to create a entry (file or directory) in the zip file.
       * If you want to create a directory the entryName must end in / and a null buffer should be provided.
       * Comment and attributes are optional
       *
       * @param {string} entryName
       * @param {Buffer | string} content - file content as buffer or utf8 coded string
       * @param {string} [comment] - file comment
       * @param {number | object} [attr] - number as unix file permissions, object as filesystem Stats object
       */
      addFile: function(entryName, content, comment, attr) {
        entryName = zipnamefix(entryName);
        let entry = getEntry(entryName);
        const update = entry != null;
        if (!update) {
          entry = new ZipEntry(opts);
          entry.entryName = entryName;
        }
        entry.comment = comment || "";
        const isStat = "object" === typeof attr && attr instanceof filetools.fs.Stats;
        if (isStat) {
          entry.header.time = attr.mtime;
        }
        var fileattr = entry.isDirectory ? 16 : 0;
        let unix = entry.isDirectory ? 16384 : 32768;
        if (isStat) {
          unix |= 4095 & attr.mode;
        } else if ("number" === typeof attr) {
          unix |= 4095 & attr;
        } else {
          unix |= entry.isDirectory ? 493 : 420;
        }
        fileattr = (fileattr | unix << 16) >>> 0;
        entry.attr = fileattr;
        entry.setData(content);
        if (!update) _zip.setEntry(entry);
        return entry;
      },
      /**
       * Returns an array of ZipEntry objects representing the files and folders inside the archive
       *
       * @param {string} [password]
       * @returns Array
       */
      getEntries: function(password) {
        _zip.password = password;
        return _zip ? _zip.entries : [];
      },
      /**
       * Returns a ZipEntry object representing the file or folder specified by ``name``.
       *
       * @param {string} name
       * @return ZipEntry
       */
      getEntry: function(name) {
        return getEntry(name);
      },
      getEntryCount: function() {
        return _zip.getEntryCount();
      },
      forEach: function(callback) {
        return _zip.forEach(callback);
      },
      /**
       * Extracts the given entry to the given targetPath
       * If the entry is a directory inside the archive, the entire directory and it's subdirectories will be extracted
       *
       * @param {string|ZipEntry} entry - ZipEntry object or String with the full path of the entry
       * @param {string} targetPath - Target folder where to write the file
       * @param {boolean} [maintainEntryPath=true] - If maintainEntryPath is true and the entry is inside a folder, the entry folder will be created in targetPath as well. Default is TRUE
       * @param {boolean} [overwrite=false] - If the file already exists at the target path, the file will be overwriten if this is true.
       * @param {boolean} [keepOriginalPermission=false] - The file will be set as the permission from the entry if this is true.
       * @param {string} [outFileName] - String If set will override the filename of the extracted file (Only works if the entry is a file)
       *
       * @return Boolean
       */
      extractEntryTo: function(entry, targetPath, maintainEntryPath, overwrite, keepOriginalPermission, outFileName) {
        overwrite = get_Bool(false, overwrite);
        keepOriginalPermission = get_Bool(false, keepOriginalPermission);
        maintainEntryPath = get_Bool(true, maintainEntryPath);
        outFileName = get_Str(keepOriginalPermission, outFileName);
        var item = getEntry(entry);
        if (!item) {
          throw Utils.Errors.NO_ENTRY();
        }
        var entryName = canonical(item.entryName);
        var target = sanitize(targetPath, outFileName && !item.isDirectory ? canonical(outFileName) : maintainEntryPath ? entryName : pth.basename(entryName));
        if (item.isDirectory) {
          var children = _zip.getEntryChildren(item);
          children.forEach(function(child) {
            if (child.isDirectory) return;
            var content2 = child.getData();
            if (!content2) {
              throw Utils.Errors.CANT_EXTRACT_FILE();
            }
            var name = canonical(maintainEntryPath ? child.entryName : child.entryName.substring(item.entryName.length));
            var childName = sanitize(targetPath, name);
            const fileAttr2 = keepOriginalPermission ? child.header.fileAttr : void 0;
            filetools.writeFileTo(childName, content2, overwrite, fileAttr2);
          });
          return true;
        }
        var content = item.getData(_zip.password);
        if (!content) throw Utils.Errors.CANT_EXTRACT_FILE();
        if (filetools.fs.existsSync(target) && !overwrite) {
          throw Utils.Errors.CANT_OVERRIDE();
        }
        const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
        filetools.writeFileTo(target, content, overwrite, fileAttr);
        return true;
      },
      /**
       * Test the archive
       * @param {string} [pass]
       */
      test: function(pass) {
        if (!_zip) {
          return false;
        }
        for (var entry of _zip.entries) {
          try {
            if (entry.isDirectory) {
              continue;
            }
            var content = entry.getData(pass);
            if (!content) {
              return false;
            }
          } catch (err) {
            return false;
          }
        }
        return true;
      },
      /**
       * Extracts the entire archive to the given location
       *
       * @param {string} targetPath Target location
       * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
       *                  Default is FALSE
       * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
       *                  Default is FALSE
       * @param {string|Buffer} [pass] password
       */
      extractAllTo: function(targetPath, overwrite, keepOriginalPermission, pass) {
        keepOriginalPermission = get_Bool(false, keepOriginalPermission);
        pass = get_Str(keepOriginalPermission, pass);
        overwrite = get_Bool(false, overwrite);
        if (!_zip) throw Utils.Errors.NO_ZIP();
        const dirEntries = [];
        _zip.entries.forEach(function(entry) {
          var entryName = sanitize(targetPath, canonical(entry.entryName));
          if (entry.isDirectory) {
            filetools.makeDir(entryName);
            if (keepOriginalPermission) dirEntries.push({ path: entryName, attr: entry.header.fileAttr });
            return;
          }
          var content = entry.getData(pass);
          if (!content) {
            throw Utils.Errors.CANT_EXTRACT_FILE();
          }
          const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
          filetools.writeFileTo(entryName, content, overwrite, fileAttr);
          try {
            filetools.fs.utimesSync(entryName, entry.header.time, entry.header.time);
          } catch (err) {
          }
        });
        applyDirAttributes(dirEntries);
      },
      /**
       * Asynchronous extractAllTo
       *
       * @param {string} targetPath Target location
       * @param {boolean} [overwrite=false] If the file already exists at the target path, the file will be overwriten if this is true.
       *                  Default is FALSE
       * @param {boolean} [keepOriginalPermission=false] The file will be set as the permission from the entry if this is true.
       *                  Default is FALSE
       * @param {function} callback The callback will be executed when all entries are extracted successfully or any error is thrown.
       */
      extractAllToAsync: function(targetPath, overwrite, keepOriginalPermission, callback) {
        callback = get_Fun(overwrite, keepOriginalPermission, callback);
        keepOriginalPermission = get_Bool(false, keepOriginalPermission);
        overwrite = get_Bool(false, overwrite);
        if (!callback) {
          return new Promise((resolve, reject) => {
            this.extractAllToAsync(targetPath, overwrite, keepOriginalPermission, function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this);
              }
            });
          });
        }
        if (!_zip) {
          callback(Utils.Errors.NO_ZIP());
          return;
        }
        targetPath = pth.resolve(targetPath);
        const getPath = (entry) => sanitize(targetPath, pth.normalize(canonical(entry.entryName)));
        const getError = (msg, file) => new Error(msg + ': "' + file + '"');
        const dirEntries = [];
        const fileEntries = [];
        _zip.entries.forEach((e) => {
          if (e.isDirectory) {
            dirEntries.push(e);
          } else {
            fileEntries.push(e);
          }
        });
        const deferredDirAttr = [];
        for (const entry of dirEntries) {
          const dirPath = getPath(entry);
          const dirAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
          try {
            filetools.makeDir(dirPath);
          } catch (er) {
            callback(getError("Unable to create folder", dirPath));
            continue;
          }
          if (dirAttr) deferredDirAttr.push({ path: dirPath, attr: dirAttr });
          try {
            filetools.fs.utimesSync(dirPath, entry.header.time, entry.header.time);
          } catch (er) {
          }
        }
        const done = (err) => {
          if (!err) {
            try {
              applyDirAttributes(deferredDirAttr);
            } catch (er) {
              return callback(getError("Unable to set folder permissions", er.path || ""));
            }
          }
          callback(err);
        };
        fileEntries.reverse().reduce(function(next, entry) {
          return function(err) {
            if (err) {
              next(err);
            } else {
              const entryName = pth.normalize(canonical(entry.entryName));
              const filePath = sanitize(targetPath, entryName);
              entry.getDataAsync(function(content, err_1) {
                if (err_1) {
                  next(err_1);
                } else if (!content) {
                  next(Utils.Errors.CANT_EXTRACT_FILE());
                } else {
                  const fileAttr = keepOriginalPermission ? entry.header.fileAttr : void 0;
                  filetools.writeFileToAsync(filePath, content, overwrite, fileAttr, function(succ) {
                    if (!succ) {
                      return next(getError("Unable to write file", filePath));
                    }
                    filetools.fs.utimes(filePath, entry.header.time, entry.header.time, function() {
                      next();
                    });
                  });
                }
              });
            }
          };
        }, done)();
      },
      /**
       * Writes the newly created zip file to disk at the specified location or if a zip was opened and no ``targetFileName`` is provided, it will overwrite the opened zip
       *
       * @param {string} targetFileName
       * @param {function} callback
       */
      writeZip: function(targetFileName, callback) {
        if (arguments.length === 1) {
          if (typeof targetFileName === "function") {
            callback = targetFileName;
            targetFileName = "";
          }
        }
        if (!targetFileName && opts.filename) {
          targetFileName = opts.filename;
        }
        if (!targetFileName) return;
        var zipData = _zip.compressToBuffer();
        if (zipData) {
          var ok = filetools.writeFileTo(targetFileName, zipData, true);
          if (typeof callback === "function") callback(!ok ? new Error("failed") : null, "");
        }
      },
      /**
      	         *
      	         * @param {string} targetFileName
      	         * @param {object} [props]
      	         * @param {boolean} [props.overwrite=true] If the file already exists at the target path, the file will be overwriten if this is true.
      	         * @param {boolean} [props.perm] The file will be set as the permission from the entry if this is true.
      
      	         * @returns {Promise<void>}
      	         */
      writeZipPromise: function(targetFileName, props) {
        const { overwrite, perm } = Object.assign({ overwrite: true }, props);
        return new Promise((resolve, reject) => {
          if (!targetFileName && opts.filename) targetFileName = opts.filename;
          if (!targetFileName) reject("ADM-ZIP: ZIP File Name Missing");
          this.toBufferPromise().then((zipData) => {
            const ret = (done) => done ? resolve(done) : reject("ADM-ZIP: Wasn't able to write zip file");
            filetools.writeFileToAsync(targetFileName, zipData, overwrite, perm, ret);
          }, reject);
        });
      },
      /**
       * @returns {Promise<Buffer>} A promise to the Buffer.
       */
      toBufferPromise: function() {
        return new Promise((resolve, reject) => {
          _zip.toAsyncBuffer(resolve, reject);
        });
      },
      /**
       * Returns the content of the entire zip file as a Buffer object
       *
       * @prop {function} [onSuccess]
       * @prop {function} [onFail]
       * @prop {function} [onItemStart]
       * @prop {function} [onItemEnd]
       * @returns {Buffer}
       */
      toBuffer: function(onSuccess, onFail, onItemStart, onItemEnd) {
        if (typeof onSuccess === "function") {
          _zip.toAsyncBuffer(onSuccess, onFail, onItemStart, onItemEnd);
          return null;
        }
        return _zip.compressToBuffer();
      }
    };
  };
  return admZip;
}
var admZipExports = requireAdmZip();
const AdmZip = /* @__PURE__ */ getDefaultExportFromCjs(admZipExports);
const logger$1 = new Logger("ModManager");
class ModManagerService {
  /**
   * Lists all mods installed in the server's mods directory.
   */
  static getInstalledMods(serverDir) {
    const modsDir = path.join(serverDir, "mods");
    if (!fs.existsSync(modsDir)) {
      return [];
    }
    try {
      const files = fs.readdirSync(modsDir);
      const list = [];
      for (const file of files) {
        if (file.endsWith(".jar") || file.endsWith(".jar.disabled")) {
          const fullPath = path.join(modsDir, file);
          const stats = fs.statSync(fullPath);
          const isEnabled = file.endsWith(".jar");
          const cleanName = file.replace(/\.jar(\.disabled)?$/, "");
          list.push({
            name: cleanName,
            filename: file,
            size: stats.size,
            enabled: isEnabled
          });
        }
      }
      return list;
    } catch (e) {
      logger$1.error("Failed to list mods", e);
      return [];
    }
  }
  /**
   * Toggles a mod enabled/disabled by renaming the jar extension.
   */
  static toggleMod(serverDir, filename) {
    const modsDir = path.join(serverDir, "mods");
    const oldPath = path.join(modsDir, filename);
    if (!fs.existsSync(oldPath)) return false;
    let newPath = "";
    if (filename.endsWith(".disabled")) {
      newPath = path.join(modsDir, filename.replace(".disabled", ""));
    } else {
      newPath = path.join(modsDir, `${filename}.disabled`);
    }
    fs.renameSync(oldPath, newPath);
    return true;
  }
  /**
   * Deletes a mod jar file.
   */
  static deleteMod(serverDir, filename) {
    const modsDir = path.join(serverDir, "mods");
    const target = path.join(modsDir, filename);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      return true;
    }
    return false;
  }
  /**
   * Uploads and extracts a Mod Package (.zip) directly into the server's mods directory.
   * Only extracts .jar files to prevent extracting unnecessary meta files.
   */
  static async uploadModPackage(serverDir, zipFilePath) {
    const modsDir = path.join(serverDir, "mods");
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    try {
      logger$1.info(`Extracting mod package ${zipFilePath} to ${modsDir}`);
      const zip = new AdmZip(zipFilePath);
      const zipEntries = zip.getEntries();
      let jarCount = 0;
      for (const entry of zipEntries) {
        if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith(".jar")) {
          const content = entry.getData();
          const fileName = path.basename(entry.entryName);
          const destPath = path.join(modsDir, fileName);
          fs.writeFileSync(destPath, content);
          jarCount++;
        }
      }
      logger$1.info(`Extracted ${jarCount} mods from ${zipFilePath}`);
      return jarCount;
    } catch (e) {
      logger$1.error("Failed to extract mod package", e);
      throw e;
    }
  }
}
function registerModsIpc() {
  electron.ipcMain.handle("mods:get-installed", (_, serverId) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ModManagerService.getInstalledMods(serverDir);
  });
  electron.ipcMain.handle("mods:upload-package", async (_, { serverId, zipFilePath }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return await ModManagerService.uploadModPackage(serverDir, zipFilePath);
  });
  electron.ipcMain.handle("mods:toggle", (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ModManagerService.toggleMod(serverDir, filename);
  });
  electron.ipcMain.handle("mods:delete", (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ModManagerService.deleteMod(serverDir, filename);
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
  const iconPath = process.platform === "win32" ? path.join(__dirname, "../src/assets/craftora.ico") : path.join(__dirname, "../src/assets/craftora.png");
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
  registerModsIpc();
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
