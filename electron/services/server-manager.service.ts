import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pidusage from 'pidusage';
import { ConfigParserService } from './config-parser.service';
import { JavaDetectorService } from './java-detector.service';
import { Logger } from '../utils/logger';

const logger = new Logger('ServerManager');

export type ServerStatus = 'STOPPED' | 'STARTING' | 'ONLINE' | 'STOPPING' | 'CRASHED';

export interface ServerMetrics {
  cpu: number;
  memoryMb: number;
  tps: number;
  onlinePlayers: number;
  maxPlayers: number;
  uptimeSeconds: number;
}

export interface PlayerInfo {
  username: string;
  uuid?: string;
  ip?: string;
  joinedAt: number;
  isOp?: boolean;
}

export interface ServerInstanceConfig {
  id: string;
  name: string;
  serverDir: string;
  javaPath: string;
  allocatedRamGb: number;
  serverSoftware: string;
  version: string;
  useAikarFlags: boolean;
  port: number;
  isCracked: boolean;
  networkMode?: 'cloud_relay' | 'upnp' | 'lan_only';
  keepInventory?: boolean;
  showCoordinates?: boolean;
  onePlayerSleep?: boolean;
  disableMobGriefing?: boolean;
  disableFireSpread?: boolean;
}

export class ServerManagerService {
  private static activeProcess: ChildProcess | null = null;
  private static status: ServerStatus = 'STOPPED';
  private static activeConfig: ServerInstanceConfig | null = null;
  private static startTime: number = 0;
  private static monitorTimer: NodeJS.Timeout | null = null;

  private static players: Map<string, PlayerInfo> = new Map();
  private static currentMetrics: ServerMetrics = {
    cpu: 0,
    memoryMb: 0,
    tps: 20.0,
    onlinePlayers: 0,
    maxPlayers: 20,
    uptimeSeconds: 0
  };

  // Event callbacks
  private static onLogCallback?: (logs: Array<{ line: string; type: 'stdout' | 'stderr' | 'system' }>) => void;
  private static onStatusCallback?: (status: ServerStatus) => void;
  private static onMetricsCallback?: (metrics: ServerMetrics) => void;
  private static onPlayersCallback?: (players: PlayerInfo[]) => void;

  private static logBatch: Array<{ line: string; type: 'stdout' | 'stderr' | 'system' }> = [];
  private static logFlushTimer: NodeJS.Timeout | null = null;
  private static logHistory: Array<{ line: string; type: 'stdout' | 'stderr' | 'system' }> = [];

  static setCallbacks(callbacks: {
    onLog?: (logs: Array<{ line: string; type: 'stdout' | 'stderr' | 'system' }>) => void;
    onStatus?: (status: ServerStatus) => void;
    onMetrics?: (metrics: ServerMetrics) => void;
    onPlayers?: (players: PlayerInfo[]) => void;
  }): void {
    this.onLogCallback = callbacks.onLog;
    this.onStatusCallback = callbacks.onStatus;
    this.onMetricsCallback = callbacks.onMetrics;
    this.onPlayersCallback = callbacks.onPlayers;
  }

  /**
   * Generates Aikar's optimized G1GC JVM startup flags based on allocated RAM.
   */
  static buildJvmArguments(ramGb: number, useAikarFlags: boolean = true): string[] {
    const memoryArgs = [`-Xms${ramGb}G`, `-Xmx${ramGb}G`];

    if (!useAikarFlags) {
      return [...memoryArgs, '-jar', 'server.jar', 'nogui'];
    }

    // Aikar's modern G1GC tuning flags
    const aikarFlags = [
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30',
      '-XX:G1MaxNewSizePercent=40',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:G1MixedGCLiveThresholdPercent=90',
      '-XX:G1RSetUpdatingPauseTimePercent=5',
      '-XX:SurvivorRatio=32',
      '-XX:+PerfDisableSharedMem',
      '-XX:MaxTenuringThreshold=1',
      '-Dusing.aikars.flags=https://mcflags.emc.gs',
      '-Daikars.new.flags=true'
    ];

    return [...memoryArgs, ...aikarFlags, '-jar', 'server.jar', 'nogui'];
  }

  /**
   * Starts the Minecraft server instance.
   */
  static async startServer(config: ServerInstanceConfig): Promise<boolean> {
    if (this.activeProcess || this.status === 'STARTING' || this.status === 'ONLINE') {
      logger.warn('Server is already running or starting');
      return false;
    }

    const jarPath = path.join(config.serverDir, 'server.jar');
    if (!fs.existsSync(jarPath)) {
      this.emitLog(`[Craftora] Error: server.jar not found at ${jarPath}`, 'system');
      return false;
    }

    // Ensure EULA is accepted
    ConfigParserService.acceptEula(config.serverDir);

    // Apply cracked mode / properties setting
    ConfigParserService.setCrackedMode(config.serverDir, config.isCracked);

    this.activeConfig = config;
    this.setStatus('STARTING');
    this.players.clear();
    this.notifyPlayersChanged();

    // 1. Determine required Java version based on Minecraft release
    let requiredMajor = 21;
    const parts = (config.version || '1.21.4').split('.');
    const mcMajor = parseInt(parts[0], 10) || 1;
    const mcMinor = parts.length > 1 ? parseInt(parts[1], 10) : 20;
    const mcPatch = parts.length > 2 ? parseInt(parts[2], 10) : 0;

    if (mcMajor >= 26) {
      requiredMajor = 25; // 26.x requires Java 25+
    } else if (mcMajor === 1 && (mcMinor >= 21 || (mcMinor === 20 && mcPatch >= 5))) {
      requiredMajor = 21; // 1.20.5+ requires Java 21
    } else if (mcMajor === 1 && mcMinor >= 18) {
      requiredMajor = 17; // 1.18 - 1.20.4 requires Java 17
    }

    // 2. Validate selected Java runtime
    let javaExecutable = config.javaPath || 'java';
    let currentJava = await JavaDetectorService.probeJavaPath(javaExecutable);

    if (!currentJava || currentJava.majorVersion < requiredMajor) {
      this.emitLog(`[Craftora] Minecraft ${config.version} requires Java ${requiredMajor}+ (Selected: ${currentJava ? `Java ${currentJava.majorVersion}` : 'Default PATH'}). Searching for compatible runtime...`, 'system');

      const allRuntimes = await JavaDetectorService.detectJavaRuntimes();
      const compatible = allRuntimes.find(r => r.majorVersion >= requiredMajor);

      if (compatible) {
        javaExecutable = compatible.path;
        config.javaPath = compatible.path;
        this.emitLog(`[Craftora] Auto-selected compatible Java ${compatible.majorVersion} (${compatible.path})`, 'system');
      } else {
        this.emitLog(`[Craftora] Downloading portable OpenJDK ${requiredMajor} to workspace...`, 'system');
        const downloadedJava = await JavaDetectorService.downloadAndExtractPortableJdk(requiredMajor, (pct) => {
          this.emitLog(`[Craftora] Downloading Java ${requiredMajor}... ${pct}%`, 'system');
        });
        if (downloadedJava) {
          javaExecutable = downloadedJava;
          config.javaPath = downloadedJava;
          this.emitLog(`[Craftora] Portable Java ${requiredMajor} is ready! Launching server...`, 'system');
        } else {
          this.emitLog(`[Craftora] Warning: Could not auto-download Java ${requiredMajor}. Attempting launch with current runtime...`, 'system');
        }
      }
    }

    const jvmArgs = this.buildJvmArguments(config.allocatedRamGb, config.useAikarFlags);
    this.emitLog(`[Craftora] Launching ${config.serverSoftware.toUpperCase()} (${config.version}) with ${config.allocatedRamGb}GB RAM...`, 'system');
    this.emitLog(`[Craftora] Java: ${javaExecutable}`, 'system');

    try {
      this.activeProcess = spawn(javaExecutable, jvmArgs, {
        cwd: config.serverDir,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.startTime = Date.now();

      // Handle standard output
      this.activeProcess.stdout?.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          this.parseServerLogLine(line);
          this.emitLog(line, 'stdout');
        }
      });

      // Handle error output
      this.activeProcess.stderr?.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) continue;
          this.emitLog(line, 'stderr');
        }
      });

      // Handle process exit
      this.activeProcess.on('exit', (code, signal) => {
        logger.info(`Server process exited with code ${code}, signal ${signal}`);
        const wasStarting = this.status === 'STARTING';

        // Detect if a crash report was generated or if it exited prematurely while STARTING
        let hasCrash = false;
        if (this.activeConfig?.serverDir) {
          const crashDir = path.join(this.activeConfig.serverDir, 'crash-reports');
          if (fs.existsSync(crashDir)) {
            try {
              const files = fs.readdirSync(crashDir);
              if (files.length > 0) {
                const latest = files.sort().reverse()[0];
                const stat = fs.statSync(path.join(crashDir, latest));
                // Crash report generated within the last 2 minutes
                if (Date.now() - stat.mtimeMs < 120000) {
                  hasCrash = true;
                }
              }
            } catch {}
          }
        }

        if (code !== 0 || wasStarting || hasCrash) {
          this.emitLog(`[Craftora] Server terminated unexpectedly (exit code: ${code}). Status marked as CRASHED.`, 'stderr');
          this.cleanUpProcess();
          this.setStatus('CRASHED');
        } else {
          this.emitLog(`[Craftora] Server stopped cleanly with exit code: ${code}`, 'system');
          this.cleanUpProcess();
          this.setStatus('STOPPED');
        }
      });

      this.activeProcess.on('error', (err) => {
        logger.error('Failed to spawn server process', err);
        this.emitLog(`[Craftora] Process error: ${err.message}`, 'system');
        this.cleanUpProcess();
        this.setStatus('CRASHED');
      });

      this.startMetricsMonitor();
      return true;
    } catch (err: any) {
      logger.error('Failed to start server', err);
      this.emitLog(`[Craftora] Start error: ${err.message}`, 'system');
      this.setStatus('CRASHED');
      return false;
    }
  }

  /**
   * Gracefully stops the server by issuing the "stop" command.
   */
  static stopServer(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.activeProcess || this.status === 'STOPPED') {
        this.setStatus('STOPPED');
        return resolve(true);
      }

      this.setStatus('STOPPING');
      this.emitLog('[Craftora] Sending graceful stop command to server...', 'system');

      try {
        this.activeProcess.stdin?.write('stop\n');
      } catch (e) {
        logger.warn('Failed to write stop command, terminating process', e);
        this.activeProcess.kill('SIGTERM');
      }

      // Timeout fallback: force kill after 15 seconds if hanging
      const forceTimeout = setTimeout(() => {
        if (this.activeProcess) {
          this.emitLog('[Craftora] Server hung on shutdown. Force terminating...', 'system');
          this.activeProcess.kill('SIGKILL');
        }
        resolve(true);
      }, 15000);

      this.activeProcess.once('exit', () => {
        clearTimeout(forceTimeout);
        resolve(true);
      });
    });
  }

  /**
   * Immediately kills the server process.
   */
  static killServer(): void {
    if (this.activeProcess) {
      this.emitLog('[Craftora] Killing server process...', 'system');
      this.activeProcess.kill('SIGKILL');
      this.cleanUpProcess();
      this.setStatus('STOPPED');
    }
  }

  /**
   * Sends an interactive command to the server console.
   */
  static sendCommand(cmd: string): boolean {
    if (!this.activeProcess || this.status !== 'ONLINE') {
      this.emitLog(`[Craftora] Cannot send command: Server is not online.`, 'system');
      return false;
    }

    try {
      this.emitLog(`> ${cmd}`, 'system');
      this.activeProcess.stdin?.write(`${cmd}\n`);
      return true;
    } catch (e: any) {
      logger.error('Failed to send command', e);
      return false;
    }
  }

  /**
   * Parses log stream for in-game events: ready signal, player logins/logouts.
   */
  private static parseServerLogLine(line: string): void {
    // 1. Detect Server Ready
    if (line.includes('Done (') && line.includes('For help, type "help"')) {
      this.setStatus('ONLINE');
      this.emitLog('[Craftora] Server is ONLINE and accepting connections! ✨', 'system');
      this.applyGamerules();
    }

    // 2. Detect Player Join
    // Pattern e.g. "PlayerName[/127.0.0.1:54321] logged in with entity id" or "PlayerName joined the game"
    const joinMatch = line.match(/(?:INFO\]:\s+)?([a-zA-Z0-9_]{3,16})(?:\[\/([0-9.]+):(\d+)\])?\s+(?:logged in with entity id|joined the game)/);
    if (joinMatch) {
      const username = joinMatch[1];
      const ip = joinMatch[2] || undefined;
      
      if (!this.players.has(username)) {
        this.players.set(username, {
          username,
          ip,
          joinedAt: Date.now()
        });
        this.notifyPlayersChanged();
      }
    }

    // 3. Detect Player Leave
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
  private static applyGamerules(): void {
    if (!this.activeConfig) return;

    // Small delay to ensure the server console is fully ready to process commands
    setTimeout(() => {
      if (!this.activeConfig || this.status !== 'ONLINE') return;

      // 1. Keep Inventory on death
      if (this.activeConfig.keepInventory !== undefined) {
        const val = this.activeConfig.keepInventory ? 'true' : 'false';
        this.sendCommand(`gamerule keepInventory ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: keepInventory = ${val}`, 'system');
      }

      // 2. Show Coordinates HUD
      if (this.activeConfig.showCoordinates !== undefined) {
        const val = this.activeConfig.showCoordinates ? 'true' : 'false';
        this.sendCommand(`gamerule showCoordinates ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: showCoordinates = ${val}`, 'system');
      }

      // 3. 1-Player Instant Sleep Percentage
      if (this.activeConfig.onePlayerSleep !== undefined) {
        const pct = this.activeConfig.onePlayerSleep ? 1 : 100;
        this.sendCommand(`gamerule playersSleepingPercentage ${pct}`);
        this.emitLog(`[Craftora] Applied gamerule: playersSleepingPercentage = ${pct}%`, 'system');
      }

      // 4. Disable Mob Griefing
      if (this.activeConfig.disableMobGriefing !== undefined) {
        const val = this.activeConfig.disableMobGriefing ? 'false' : 'true';
        this.sendCommand(`gamerule mobGriefing ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: mobGriefing = ${val}`, 'system');
      }

      // 5. Disable Fire Spread
      if (this.activeConfig.disableFireSpread !== undefined) {
        const val = this.activeConfig.disableFireSpread ? 'false' : 'true';
        this.sendCommand(`gamerule doFireTick ${val}`);
        this.emitLog(`[Craftora] Applied gamerule: doFireTick = ${val}`, 'system');
      }
    }, 1500);
  }

  /**
   * Periodically queries pidusage for CPU and RAM consumption.
   */
  private static startMetricsMonitor(): void {
    if (this.monitorTimer) clearInterval(this.monitorTimer);

    this.monitorTimer = setInterval(async () => {
      if (!this.activeProcess || !this.activeProcess.pid || this.status === 'STOPPED') {
        return;
      }

      try {
        const stats = await pidusage(this.activeProcess.pid);
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

        // Normalize CPU usage across all logical CPU cores (0% to 100%)
        const cpuCores = Math.max(1, os.cpus().length || 1);
        const normalizedCpu = Math.min(100, Math.max(0, Math.round((stats.cpu / cpuCores) * 10) / 10));

        this.currentMetrics = {
          cpu: normalizedCpu,
          memoryMb: Math.round(stats.memory / (1024 * 1024)),
          tps: 20.0, // Stable TPS estimate
          onlinePlayers: this.players.size,
          maxPlayers: this.activeConfig?.port ? 20 : 20,
          uptimeSeconds
        };

        if (this.onMetricsCallback) {
          this.onMetricsCallback({ ...this.currentMetrics });
        }
      } catch (e) {
        // process may have just closed
      }
    }, 3000);
  }

  private static cleanUpProcess(): void {
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
      tps: 20.0,
      onlinePlayers: 0,
      maxPlayers: 20,
      uptimeSeconds: 0
    };
    if (this.onMetricsCallback) {
      this.onMetricsCallback(this.currentMetrics);
    }
  }

  private static setStatus(newStatus: ServerStatus): void {
    this.status = newStatus;
    if (this.onStatusCallback) {
      this.onStatusCallback(newStatus);
    }
  }

  private static emitLog(line: string, type: 'stdout' | 'stderr' | 'system'): void {
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

  private static flushLogs(): void {
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

  private static notifyPlayersChanged(): void {
    if (this.onPlayersCallback) {
      this.onPlayersCallback(Array.from(this.players.values()));
    }
  }

  static getStatus(): ServerStatus {
    return this.status;
  }

  static getMetrics(): ServerMetrics {
    return { ...this.currentMetrics };
  }

  static getPlayers(): PlayerInfo[] {
    return Array.from(this.players.values());
  }

  static getActiveConfig(): ServerInstanceConfig | null {
    return this.activeConfig;
  }

  static getLogHistory(serverDir?: string): Array<{ line: string; type: 'stdout' | 'stderr' | 'system' }> {
    if (this.logHistory.length > 0) {
      return [...this.logHistory];
    }

    const targetDir = serverDir || this.activeConfig?.serverDir;
    if (targetDir) {
      const latestLogPath = path.join(targetDir, 'logs', 'latest.log');
      if (fs.existsSync(latestLogPath)) {
        try {
          const content = fs.readFileSync(latestLogPath, 'utf-8');
          const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
          const tail = lines.slice(-500);
          return tail.map(line => ({
            line,
            type: (line.includes('ERROR') || line.includes('Exception') || line.includes('WARN')) ? 'stderr' : 'stdout'
          }));
        } catch (e) {
          logger.warn('Failed to read latest.log from disk', e);
        }
      }
    }

    return [];
  }

  static clearLogs(): void {
    this.logHistory = [];
  }
}
