import fs from 'fs';
import os from 'os';
import path from 'path';
import https from 'https';
import { execFile, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { shell } from 'electron';
import { AppPaths } from '../utils/paths';
import { Logger } from '../utils/logger';

const execFileAsync = promisify(execFile);
const logger = new Logger('PlayitService');
const PLAYIT_MACOS_URL = 'https://github.com/playit-cloud/playit-agent/releases/download/v2.0.2/playit-macos-universal.tar.gz';

export interface CloudTunnelStatus {
  isActive: boolean;
  status: 'STOPPED' | 'STARTING' | 'WAITING_CLAIM' | 'ONLINE' | 'ERROR';
  claimUrl: string | null;
  serverAddress: string | null;
  bedrockAddress?: string | null;
  port: number;
  error?: string | null;
}

export class PlayitService {
  private static childProcess: ChildProcess | null = null;
  private static claimWatchInterval: NodeJS.Timeout | null = null;
  private static tunnelQueryInterval: NodeJS.Timeout | null = null;

  private static currentStatus: CloudTunnelStatus = {
    isActive: false,
    status: 'STOPPED',
    claimUrl: null,
    serverAddress: null,
    bedrockAddress: null,
    port: 25565,
    error: null
  };

  private static onStatusChangeListeners: ((status: CloudTunnelStatus) => void)[] = [];

  /**
   * Registers a callback for real-time status updates.
   */
  static onStatusChange(callback: (status: CloudTunnelStatus) => void): () => void {
    this.onStatusChangeListeners.push(callback);
    return () => {
      this.onStatusChangeListeners = this.onStatusChangeListeners.filter(l => l !== callback);
    };
  }

  private static updateStatus(partial: Partial<CloudTunnelStatus>): void {
    this.currentStatus = { ...this.currentStatus, ...partial };
    for (const listener of this.onStatusChangeListeners) {
      try {
        listener({ ...this.currentStatus });
      } catch (e) {
        logger.warn('Error in status listener', e);
      }
    }
  }

  /**
   * Returns path to the portable playit tunnel executable (`playit.exe` on Windows, `playitd` on macOS).
   */
  static getBinaryPath(): string {
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    if (process.platform === 'win32') {
      return path.join(binDir, 'playit.exe');
    }
    if (process.platform === 'darwin') {
      return path.join(binDir, 'playitd');
    }
    return path.join(binDir, 'playit');
  }

  /**
   * Returns path to the playit CLI executable used for claiming (`playit` on macOS, `playit.exe` on Windows).
   */
  static getCliBinaryPath(): string {
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    return path.join(binDir, process.platform === 'win32' ? 'playit.exe' : 'playit');
  }

  /**
   * Checks if the playit binary exists on disk.
   */
  static isBinaryInstalled(): boolean {
    const binPath = this.getBinaryPath();
    if (!fs.existsSync(binPath)) return false;
    const size = fs.statSync(binPath).size;
    if (size < 1024 * 1024) return false; // too small, corrupt

    if (process.platform === 'darwin') {
      const cliPath = this.getCliBinaryPath();
      if (!fs.existsSync(cliPath)) return false;
      return fs.statSync(cliPath).size >= 1024 * 1024;
    }

    // Windows: v0.17.1 signed exe is ~4.8MB; if > 5MB it's the v1.0.10 daemon playitd — delete it and force re-download
    if (process.platform === 'win32' && size > 5 * 1024 * 1024) {
      logger.warn('Detected oversized playit daemon binary (v1.0.10) — removing and scheduling re-download of v0.17.1');
      try { fs.unlinkSync(binPath); } catch {}
      return false;
    }
    return true;
  }

  /**
   * Checks if PlayIt.gg is already claimed and has a saved secret key.
   */
  static isClaimed(): boolean {
    const { secretKey } = this.getSecretKey();
    return !!secretKey;
  }

  /**
   * Helper to download a URL (following redirects) to a destination file path.
   */
  private static downloadFile(
    downloadUrl: string,
    destPath: string,
    onProgress?: (percent: number, msg?: string) => void
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tempPath = `${destPath}.tmp`;

      const downloadFileWithRedirects = (url: string, redirectsRemaining = 5) => {
        if (redirectsRemaining <= 0) {
          reject(new Error('Too many redirects while downloading PlayIt.gg agent.'));
          return;
        }

        https.get(url, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            const nextUrl = new URL(res.headers.location, url).toString();
            downloadFileWithRedirects(nextUrl, redirectsRemaining - 1);
            return;
          }

          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`Failed to download agent. HTTP status: ${res.statusCode}`));
            return;
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let receivedBytes = 0;
          const fileStream = fs.createWriteStream(tempPath);

          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              const percent = Math.min(95, Math.round((receivedBytes / totalBytes) * 95));
              onProgress(percent, `Downloading PlayIt.gg Agent... ${percent}%`);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              try {
                if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                fs.renameSync(tempPath, destPath);
                resolve();
              } catch (e) {
                reject(e);
              }
            });
          });

          fileStream.on('error', (err) => {
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
            reject(err);
          });
        }).on('error', (err) => {
          try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
          reject(err);
        });
      };

      downloadFileWithRedirects(downloadUrl);
    });
  }

  /**
   * Downloads the official playit agent binary if not present.
   */
  static async ensureBinary(onProgress?: (percent: number, msg?: string) => void): Promise<boolean> {
    if (this.isBinaryInstalled()) {
      return true;
    }

    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);

    // macOS: Download official v2.0.2 universal tarball (Apple Silicon + Intel) containing `playit` + `playitd`
    if (process.platform === 'darwin') {
      const archivePath = path.join(binDir, 'playit-macos-universal.tar.gz');
      const extractDir = path.join(binDir, 'playit-extract-tmp');
      logger.info(`Downloading official macOS universal playit agent to: ${archivePath}`);
      if (onProgress) onProgress(10, 'Downloading PlayIt.gg Agent for macOS...');

      await this.downloadFile(PLAYIT_MACOS_URL, archivePath, onProgress);

      if (onProgress) onProgress(96, 'Extracting PlayIt.gg Agent...');
      try {
        if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
        AppPaths.ensureDir(extractDir);
        await execFileAsync('tar', ['-xzf', archivePath, '-C', extractDir]);

        const nestedDir = path.join(extractDir, 'playit-macos-universal');
        const srcDir = fs.existsSync(nestedDir) ? nestedDir : extractDir;
        const cliSrc = path.join(srcDir, 'playit');
        const daemonSrc = path.join(srcDir, 'playitd');

        if (!fs.existsSync(cliSrc) || !fs.existsSync(daemonSrc)) {
          throw new Error('PlayIt.gg macOS archive is missing playit or playitd binaries.');
        }

        const cliDest = this.getCliBinaryPath();
        const daemonDest = this.getBinaryPath();
        fs.copyFileSync(cliSrc, cliDest);
        fs.copyFileSync(daemonSrc, daemonDest);
        fs.chmodSync(cliDest, 0o755);
        fs.chmodSync(daemonDest, 0o755);

        try { await execFileAsync('xattr', ['-d', 'com.apple.quarantine', cliDest]); } catch {}
        try { await execFileAsync('xattr', ['-d', 'com.apple.quarantine', daemonDest]); } catch {}

        logger.info('PlayIt.gg macOS universal binaries extracted and ready.');
        if (onProgress) onProgress(100, 'PlayIt.gg Agent ready!');
        return true;
      } finally {
        try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch {}
        try { if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
      }
    }

    // Windows: Download official v0.17.1 signed portable executable
    const binPath = this.getBinaryPath();
    const downloadUrl = 'https://github.com/playit-cloud/playit-agent/releases/download/v0.17.1/playit-windows-x86_64-signed.exe';

    logger.info(`Downloading official playit tunnel binary to: ${binPath}`);
    if (onProgress) onProgress(10, 'Downloading PlayIt.gg Agent...');

    await this.downloadFile(downloadUrl, binPath, onProgress);
    logger.info('PlayIt.gg Agent binary downloaded successfully.');
    if (onProgress) onProgress(100, 'PlayIt.gg Agent ready!');
    return true;
  }

  /**
   * Helper to make HTTPS requests to the playit.gg API.
   */
  private static async apiRequest(endpoint: string, data: any = {}, secretKey?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const headers: Record<string, string | number> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'playit-agent/1.0.10'
      };

      if (secretKey) {
        headers['Authorization'] = `agent-key ${secretKey}`;
      }

      const req = https.request(`https://api.playit.gg${endpoint}`, {
        method: 'POST',
        headers,
        timeout: 10000
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (e) {
            resolve({ status: 'raw', data: body });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Playit API request timed out'));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Retrieves the secret key from workspace playit.toml or %LOCALAPPDATA%/playit_gg/playit.toml.
   */
  private static getSecretKey(): { secretKey: string | null; configPath: string } {
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    const workspaceToml = path.join(binDir, 'playit.toml');

    // 1. Check workspace bin/playit.toml
    if (fs.existsSync(workspaceToml)) {
      const content = fs.readFileSync(workspaceToml, 'utf8');
      // Match both v0.17.1 `secret = "..."` and v1.0.x `secret_key = "..."`
      const match = content.match(/(?:secret_key|secret)\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        return { secretKey: match[1], configPath: workspaceToml };
      }
    }

    // 2. Check system locations written by playit.exe itself
    const found = this.findSecretInKnownPaths();
    if (found) {
      // Copy it to workspace for our use
      try { fs.writeFileSync(workspaceToml, found.content, 'utf8'); } catch {}
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
  static async startClaimFlow(port: number = 25565): Promise<CloudTunnelStatus> {
    // Kill any existing process
    await this.stopTunnel();

    this.updateStatus({
      isActive: true,
      status: 'STARTING',
      claimUrl: null,
      serverAddress: null,
      port,
      error: null
    });

    const binPath = this.getBinaryPath();
    if (!fs.existsSync(binPath)) {
      this.updateStatus({ isActive: false, status: 'ERROR', error: 'PlayIt.gg binary not found. Please re-run setup.' });
      return this.currentStatus;
    }

    // Note: v0.17.1 handles its own config discovery; we do NOT pre-delete the localappdata toml
    // (v0.17.1 will start in claim mode automatically if no valid secret exists)
    const workspaceToml = path.join(AppPaths.getBinDir(), 'playit.toml');
    // Remove workspace toml to force fresh claim
    try { if (fs.existsSync(workspaceToml)) fs.unlinkSync(workspaceToml); } catch {}

    // Check if system already has a playit secret configured
    const existingSecret = this.findSecretInKnownPaths();
    if (existingSecret) {
      logger.info(`Found existing PlayIt secret at ${existingSecret.path}. Skipping claim flow and auto-starting tunnel.`);
      try { fs.writeFileSync(workspaceToml, existingSecret.content, 'utf8'); } catch {}
      setTimeout(() => this.startTunnel(port), 500);
      return this.currentStatus;
    }

    // macOS v2.0.2 claim flow using `playit claim generate / url / exchange` (no LaunchAgent required)
    if (process.platform === 'darwin') {
      const cliPath = this.getCliBinaryPath();
      if (!fs.existsSync(cliPath)) {
        this.updateStatus({ isActive: false, status: 'ERROR', error: 'PlayIt.gg CLI binary not found. Please re-run setup.' });
        return this.currentStatus;
      }

      try {
        logger.info('Generating PlayIt.gg claim code via macOS playit CLI...');
        const { stdout: genOut } = await execFileAsync(cliPath, ['claim', 'generate'], {
          cwd: AppPaths.getBinDir(),
          timeout: 15000
        });
        const claimCode = genOut.trim().split(/\s+/).pop() || '';
        if (!claimCode) {
          throw new Error('Failed to generate PlayIt.gg claim code.');
        }

        let claimUrl = `https://playit.gg/claim/${claimCode}`;
        try {
          const { stdout: urlOut } = await execFileAsync(cliPath, ['claim', 'url', claimCode, '--name', 'CraftTogether'], {
            cwd: AppPaths.getBinDir(),
            timeout: 15000
          });
          const match = urlOut.match(/https:\/\/playit\.gg\/claim\/[^\s]+/i);
          if (match) claimUrl = match[0];
        } catch {}

        logger.info(`PlayIt.gg macOS claim URL ready: ${claimUrl}`);
        this.updateStatus({
          status: 'WAITING_CLAIM',
          claimUrl
        });

        try {
          shell.openExternal(claimUrl);
        } catch (err) {
          logger.warn('Failed to auto-open claim URL in browser', err);
        }

        // Wait for user to approve claim in browser and exchange for secret key
        const exchangeChild = spawn(cliPath, ['claim', 'exchange', claimCode, '--wait', '0'], {
          cwd: AppPaths.getBinDir(),
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe']
        });
        this.childProcess = exchangeChild;

        let stdoutBuf = '';
        exchangeChild.stdout.on('data', (chunk: Buffer) => {
          stdoutBuf += chunk.toString('utf-8');
        });
        exchangeChild.stderr.on('data', (chunk: Buffer) => {
          const msg = chunk.toString('utf-8').trim();
          if (msg) logger.info(`[PlayitClaimMac] ${msg}`);
        });
        exchangeChild.on('error', (err) => {
          logger.error('PlayIt.gg macOS claim exchange error', err);
          this.updateStatus({ isActive: false, status: 'ERROR', error: err.message });
        });
        exchangeChild.on('close', (code) => {
          this.childProcess = null;
          const secret = stdoutBuf.trim().split(/\s+/).pop() || '';
          if (code === 0 && secret.length > 10) {
            logger.info('PlayIt.gg macOS claim succeeded — saving secret and starting playitd...');
            try {
              fs.writeFileSync(workspaceToml, `secret_key = "${secret}"\n`, { encoding: 'utf8', mode: 0o600 });
            } catch {}
            setTimeout(() => this.startTunnel(port), 400);
          } else if (this.currentStatus.status === 'WAITING_CLAIM') {
            logger.warn(`PlayIt.gg macOS claim exchange exited with code ${code}`);
            this.updateStatus({
              isActive: false,
              status: 'ERROR',
              error: 'PlayIt.gg claim did not complete. Click Try Again to generate a new claim link.'
            });
          }
        });

        return this.currentStatus;
      } catch (err: any) {
        logger.error('PlayIt.gg macOS claim flow failed', err);
        this.updateStatus({ isActive: false, status: 'ERROR', error: err.message || 'Failed to start PlayIt.gg claim.' });
        return this.currentStatus;
      }
    }

    logger.info('Spawning playit.exe with no arguments to generate claim URL...');

    // Spawn with no args — playit.exe will print its own claim URL to stderr
    const child = spawn(binPath, [], {
      cwd: AppPaths.getBinDir(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    this.childProcess = child;

    let claimUrlFound = false;

    const handleOutput = (data: Buffer) => {
      const text = data.toString('utf-8');
      logger.info(`[PlayitClaim] ${text.trim()}`);

      // Parse claim URL from output — playit.exe prints: https://playit.gg/claim/xxxxxxxx
      if (!claimUrlFound) {
        const claimMatch = text.match(/https:\/\/playit\.gg\/claim\/([a-z0-9]+)/i);
        if (claimMatch) {
          claimUrlFound = true;
          const claimUrl = claimMatch[0];
          logger.info(`Claim URL detected from playit.exe output: ${claimUrl}`);

          this.updateStatus({
            status: 'WAITING_CLAIM',
            claimUrl
          });

          // Open the claim URL — because playit.exe is RUNNING, the "Claim Agent" button WILL appear
          try {
            shell.openExternal(claimUrl);
          } catch (err) {
            logger.warn('Failed to auto-open claim URL in browser', err);
          }

          // Start watching for the secret key that playit.exe will write automatically
          this.startSecretWatcher(port, child);
        }
      }

      // Also detect if already online (in case the binary auto-reconnects with existing data)
      const addressMatch =
        text.match(/([a-zA-Z0-9_\-]+\.craft\.ply\.gg(?::\d+)?)/i) ||
        text.match(/([a-zA-Z0-9_\-]+\.tun\.ply\.gg(?::\d+)?)/i) ||
        text.match(/([a-zA-Z0-9_\-]+\.ply\.gg:\d+)/i) ||
        text.match(/([a-zA-Z0-9_\-]+\.playit\.gg:\d+)/i);

      if (addressMatch && addressMatch[1]) {
        const cleanAddress = addressMatch[1].trim().replace(/^tcp:\/\//i, '');
        if (!cleanAddress.includes('localhost') && !cleanAddress.includes('127.0.0.1')) {
          logger.info(`PlayIt.gg Tunnel Active (from output): ${cleanAddress}`);
          this.updateStatus({
            status: 'ONLINE',
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

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);

    child.on('error', (err) => {
      logger.error('PlayIt.gg claim process error', err);
      this.updateStatus({ isActive: false, status: 'ERROR', error: err.message });
    });

    child.on('close', (code) => {
      logger.info(`PlayIt.gg claim process closed with code ${code}`);
      this.childProcess = null;

      // If the process exited while we were waiting for a claim, it almost certainly means
      // the user just claimed in the browser and playit.exe wrote its secret then exited.
      // Search for the secret immediately and restart with it.
      if (this.currentStatus.status === 'WAITING_CLAIM') {
        logger.info('Process exited during WAITING_CLAIM — searching for secret file written by agent...');
        const found = this.findSecretInKnownPaths();
        if (found) {
          logger.info(`Secret found at: ${found.path} — restarting tunnel with secret.`);
          if (this.claimWatchInterval) {
            clearInterval(this.claimWatchInterval);
            this.claimWatchInterval = null;
          }
          const workspaceToml = path.join(AppPaths.getBinDir(), 'playit.toml');
          try { fs.writeFileSync(workspaceToml, found.content, 'utf8'); } catch {}
          setTimeout(() => this.startTunnel(port), 800);
        } else {
          // Secret not found yet — the file watcher will catch it when it appears
          logger.info('No secret found on exit — continuing to watch for config file...');
        }
      }
    });

    return this.currentStatus;
  }

  /**
   * Searches all known config file locations for a valid PlayIt.gg secret.
   * Returns the content and path of the first found secret file, or null.
   */
  private static findSecretInKnownPaths(): { path: string; content: string; secret: string } | null {
    const appData = process.env.APPDATA || '';
    const localAppData = process.env.LOCALAPPDATA || '';
    const userProfile = process.env.USERPROFILE || os.homedir() || '';
    const binDir = AppPaths.getBinDir();
    const workspaceToml = path.join(binDir, 'playit.toml');

    // All paths playit v0.17.1, v1.0.x, and v2.x (Windows + macOS) might write to
    const candidates = [
      path.join(binDir, 'config.toml'),
      path.join(appData, 'playit', 'config.toml'),
      path.join(appData, 'playit_gg', 'config.toml'),
      path.join(appData, 'playit_gg', 'playit.toml'),
      path.join(localAppData, 'playit_gg', 'playit.toml'),
      path.join(localAppData, 'playit', 'config.toml'),
      path.join(userProfile, 'Library', 'Application Support', 'playit_gg', 'playit.toml'),
      path.join(userProfile, 'Library', 'Application Support', 'playit', 'config.toml'),
      path.join(userProfile, '.config', 'playit', 'config.toml'),
      path.join(userProfile, '.playit', 'config.toml'),
    ];

    // Also scan all .toml files in the bin dir
    try {
      const files = fs.readdirSync(binDir).filter(f => f.endsWith('.toml'));
      for (const f of files) {
        const p = path.join(binDir, f);
        if (p !== workspaceToml && !candidates.includes(p)) {
          candidates.unshift(p);
        }
      }
    } catch {}

    for (const candidate of candidates) {
      // Skip our own workspace toml — we write it, not playit.exe
      if (candidate === workspaceToml) continue;
      try {
        if (!fs.existsSync(candidate)) continue;
        const content = fs.readFileSync(candidate, 'utf8');
        // Match both `secret_key = "..."` (v1.0.x) and `secret = "..."` (v0.17.x)
        const match = content.match(/(?:secret_key|secret)\s*=\s*"([^"]+)"/);
        if (match && match[1] && match[1].length > 10) {
          logger.info(`Found secret in: ${candidate}`);
          return { path: candidate, content, secret: match[1] };
        }
      } catch {}
    }
    return null;
  }

  /**
   * Watches for the secret key file that playit.exe auto-writes after a successful browser claim.
   * Checks all known config file locations every 2 seconds.
   * When found: copies to workspace, kills unclaimed process, restarts with secret.
   */
  private static startSecretWatcher(port: number, claimProcess: ChildProcess): void {
    if (this.claimWatchInterval) {
      clearInterval(this.claimWatchInterval);
      this.claimWatchInterval = null;
    }

    const workspaceToml = path.join(AppPaths.getBinDir(), 'playit.toml');
    logger.info('Secret watcher started — polling all known PlayIt.gg config locations...');

    this.claimWatchInterval = setInterval(async () => {
      try {
        const found = this.findSecretInKnownPaths();
        if (!found) return;

        logger.info('Secret key obtained from playit.gg claim! Transitioning to tunnel mode...');

        // Stop watcher
        if (this.claimWatchInterval) {
          clearInterval(this.claimWatchInterval);
          this.claimWatchInterval = null;
        }

        // Save secret to workspace toml
        try { fs.writeFileSync(workspaceToml, found.content, 'utf8'); } catch {}

        // We DO NOT kill the process here. PlayIt v0.17 automatically authenticates 
        // using the newly created system toml and stays online. 
        // This prevents the browser from showing 'Agent is offline'.
        logger.info('PlayIt agent successfully claimed. Starting API polling...');
        
        this.updateStatus({
          isActive: true,
          status: 'ONLINE',
          serverAddress: null,
          claimUrl: null,
          error: null
        });

        this.startApiPolling(found.secret, port);

      } catch (e) {
        logger.warn('Error in secret watcher', e);
      }
    }, 2000);
  }

  private static isRestartingForClaim = false;

  /**
   * Queries playit.gg API for active public tunnel addresses.
   */
  private static async queryPublicAddress(secretKey: string, port: number): Promise<{ isConnected: boolean, address: string | null, bedrockAddress: string | null }> {
    try {
      let address: string | null = null;
      let bedrockAddress: string | null = null;

      // 1. Check tunnels list
      const listRes = await this.apiRequest('/tunnels/list', {}, secretKey);
      if (listRes && listRes.status === 'success' && Array.isArray(listRes.data?.tunnels)) {
        for (const tunnel of listRes.data.tunnels) {
          const alloc = tunnel.alloc?.data;
          if (!alloc) continue;
          
          const tunnelAddr = alloc.assigned_domain ? `${alloc.assigned_domain}:${alloc.port_start}` : null;
          
          if (tunnel.tunnel_type === 'minecraft-bedrock' || tunnel.port_type === 'udp' || (tunnel.origin?.data?.local_port === 19132)) {
             bedrockAddress = tunnelAddr;
          } else if (tunnel.tunnel_type === 'minecraft-java' || tunnel.port_type === 'tcp' || (tunnel.origin?.data?.local_port === 25565)) {
             address = tunnelAddr;
          }
        }
        
        // If we found any valid address from list, we are good
        if (address || bedrockAddress) {
           return { isConnected: true, address, bedrockAddress };
        }
      }
      
      // Fallback to check raw agent run data if list didn't give what we want
      const runRes = await this.apiRequest('/agents/rundata', {}, secretKey);
      if (runRes && runRes.status === 'success') {
        const rawJson = JSON.stringify(runRes);
        const addressMatch =
          rawJson.match(/([a-zA-Z0-9_\-]+\.craft\.ply\.gg(?::\d+)?)/i) ||
          rawJson.match(/([a-zA-Z0-9_\-]+\.tun\.ply\.gg(?::\d+)?)/i) ||
          rawJson.match(/([a-zA-Z0-9_\-]+\.ply\.gg:\d+)/i) ||
          rawJson.match(/([a-zA-Z0-9_\-]+\.playit\.gg:\d+)/i);

        if (addressMatch && addressMatch[1]) {
           let cleanAddress = addressMatch[1].trim().replace(/^tcp:\/\//i, '');
           if (!cleanAddress.includes('localhost') && !cleanAddress.includes('127.0.0.1')) {
              if (!cleanAddress.includes(':')) {
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
      
      // If API succeeded but no address was found, we are connected but waiting for tunnel
      if (listRes && listRes.status === 'success') {
         return { isConnected: true, address: null, bedrockAddress: null };
      }
    } catch (e) {
      logger.warn('Failed to query public tunnel address from API', e);
    }
    return { isConnected: false, address: null, bedrockAddress: null };
  }

  /**
   * Starts continuous polling for the public tunnel address.
   */
  private static startApiPolling(secretKey: string, port: number) {
    if (this.tunnelQueryInterval) clearInterval(this.tunnelQueryInterval);

    const checkAddress = async () => {
      const result = await this.queryPublicAddress(secretKey, port);
      if (result.isConnected) {
        logger.info(`PlayIt.gg Agent authenticated. Address: ${result.address || 'none yet'}, Bedrock: ${result.bedrockAddress || 'none yet'}`);
        this.updateStatus({
          status: 'ONLINE',
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
    }, 3000);
  }

  /**
   * Starts the embedded PlayIt.gg tunnel process for the Minecraft server port.
   * If no secret key found, launches the full claim flow.
   */
  static async startTunnel(port: number = 25565): Promise<CloudTunnelStatus> {
    if (this.childProcess) {
      if (this.currentStatus.isActive && this.currentStatus.status === 'ONLINE') {
        return this.currentStatus;
      }
      await this.stopTunnel();
    }

    this.updateStatus({
      isActive: true,
      status: 'STARTING',
      port,
      claimUrl: null,
      serverAddress: null,
      error: null
    });

    try {
      const isReady = await this.ensureBinary();
      if (!isReady) {
        throw new Error('Failed to download PlayIt.gg Agent executable.');
      }

      const { secretKey, configPath } = this.getSecretKey();

      // If no secret key is found, initiate the correct process-based claim flow
      if (!secretKey) {
        return await this.startClaimFlow(port);
      }

      const binPath = this.getBinaryPath();
      const workingDir = AppPaths.getBinDir();

      logger.info(`Starting PlayIt.gg process with secret: ${binPath}`);

      // Spawn with secret — authenticated daemon mode
      // macOS runs v2.0.2 `playitd` directly with `--secret` and a workspace-scoped IPC socket (no LaunchAgent needed)
      const spawnArgs = process.platform === 'darwin'
        ? ['--secret', secretKey, '--socket-path', path.join(workingDir, 'playit.sock')]
        : ['--secret_path', configPath, '--stdout', 'start'];

      const child = spawn(binPath, spawnArgs, {
        cwd: workingDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      this.childProcess = child;

      const handleOutput = async (data: Buffer) => {
        const text = data.toString('utf-8');
        
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          const isSpam = 
            trimmed.includes('tunnel running') || 
            trimmed.includes('udp session details received') ||
            trimmed.includes('udp channel requires auth') ||
            trimmed.includes('send KeepAlive') ||
            trimmed.includes('playit_agent_core::') ||
            trimmed.includes('playit_cli::ui: playit') ||
            trimmed.includes('clear old:') ||
            trimmed.includes('pipe ended due to EOF') ||
            trimmed.includes('authenticate control') ||
            trimmed.includes('session expired') ||
            trimmed.includes('tunnel_addr') ||
            trimmed.includes('pong=Pong') ||
            trimmed.includes('agent registered') ||
            trimmed.includes('New TCP Client details=');

          if (!isSpam) {
            logger.info(`[PlayitAgent] ${trimmed}`);
          }
        }

        if (text.includes('Invalid secret')) {
          logger.warn('PlayIt Agent detected an invalid secret! Auto-resetting and returning to claim flow...');
          if (this.tunnelQueryInterval) {
            clearInterval(this.tunnelQueryInterval);
            this.tunnelQueryInterval = null;
          }
          const workspaceToml = path.join(workingDir, 'playit.toml');
          try { if (fs.existsSync(workspaceToml)) fs.unlinkSync(workspaceToml); } catch {}
          const sysSecret = this.findSecretInKnownPaths();
          if (sysSecret) {
            try { if (fs.existsSync(sysSecret.path)) fs.unlinkSync(sysSecret.path); } catch {}
          }

          // Kill current process
          try {
            if (process.platform === 'win32' && child.pid) {
              spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t'], { stdio: 'ignore', windowsHide: true });
            } else {
              child.kill('SIGINT');
            }
          } catch {}
          this.childProcess = null;

          // Silently restart claim flow to replace the dead secret
          setTimeout(() => this.startClaimFlow(port), 500);
          return;
        }

        // Detect Live Public Address from stdout
        const addressMatch =
          text.match(/([a-zA-Z0-9_\-]+\.craft\.ply\.gg(?::\d+)?)/i) ||
          text.match(/([a-zA-Z0-9_\-]+\.tun\.ply\.gg(?::\d+)?)/i) ||
          text.match(/([a-zA-Z0-9_\-]+\.ply\.gg:\d+)/i) ||
          text.match(/([a-zA-Z0-9_\-]+\.playit\.gg:\d+)/i) ||
          text.match(/tunnel:\s*([^\s\r\n]+)/i);

        if (addressMatch && addressMatch[1]) {
          const cleanAddress = addressMatch[1].trim().replace(/^tcp:\/\//i, '');
          if (!cleanAddress.includes('localhost') && !cleanAddress.includes('127.0.0.1')) {
            logger.info(`PlayIt.gg Tunnel Online: ${cleanAddress}`);
            this.updateStatus({
              status: 'ONLINE',
              serverAddress: cleanAddress,
              claimUrl: null,
              error: null
            });
          }
        }
      };

      child.stdout.on('data', handleOutput);
      child.stderr.on('data', handleOutput);

      child.on('error', (err) => {
        logger.error('PlayIt.gg process encountered an error', err);
        this.updateStatus({
          isActive: false,
          status: 'ERROR',
          error: err.message || 'Failed to start PlayIt.gg process.'
        });
      });

      child.on('close', (code) => {
        logger.info(`PlayIt.gg process exited with code ${code}`);
        this.childProcess = null;
        if (this.currentStatus.isActive && this.currentStatus.status !== 'ERROR') {
          if (this.isRestartingForClaim) {
            this.isRestartingForClaim = false;
            // Skip setting status to STOPPED because we are just restarting the binary for the claim
          } else {
            this.updateStatus({
              isActive: false,
              status: 'STOPPED',
              serverAddress: null,
              claimUrl: null
            });
          }
        }
      });

      this.startApiPolling(secretKey, port);

      return this.currentStatus;
    } catch (err: any) {
      logger.error('Failed to start PlayIt.gg tunnel', err);
      this.updateStatus({
        isActive: false,
        status: 'ERROR',
        error: err.message || 'Failed to launch PlayIt.gg engine.'
      });
      return this.currentStatus;
    }
  }

  /**
   * Stops the active PlayIt.gg tunnel process.
   */
  static async stopTunnel(): Promise<CloudTunnelStatus> {
    if (this.claimWatchInterval) {
      clearInterval(this.claimWatchInterval);
      this.claimWatchInterval = null;
    }

    if (this.tunnelQueryInterval) {
      clearInterval(this.tunnelQueryInterval);
      this.tunnelQueryInterval = null;
    }

    if (this.childProcess) {
      logger.info('Stopping PlayIt.gg background process...');
      try {
        if (process.platform === 'win32' && this.childProcess.pid) {
          spawn('taskkill', ['/pid', this.childProcess.pid.toString(), '/f', '/t'], { stdio: 'ignore', windowsHide: true });
        } else {
          this.childProcess.kill('SIGINT');
        }
      } catch (e) {
        logger.warn('Failed to kill PlayIt.gg process cleanly', e);
      }
      this.childProcess = null;
    }

    this.updateStatus({
      isActive: false,
      status: 'STOPPED',
      serverAddress: null,
      claimUrl: null,
      error: null
    });

    return this.currentStatus;
  }

  /**
   * Returns current Cloud Relay status.
   */
  static getStatus(): CloudTunnelStatus {
    return { ...this.currentStatus };
  }
}
