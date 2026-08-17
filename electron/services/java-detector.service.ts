import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import https from 'https';
import { AppPaths } from '../utils/paths';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = new Logger('JavaDetector');

export interface JavaRuntime {
  path: string;
  version: string;
  majorVersion: number;
  isDefault: boolean;
  vendor: string;
}

export class JavaDetectorService {
  private static cachedRuntimes: JavaRuntime[] | null = null;

  static clearCache(): void {
    this.cachedRuntimes = null;
  }

  /**
   * Discovers all available Java runtimes on the Windows host and in workspace bin.
   * Cached in-memory for instant sub-millisecond responses on repeated queries.
   */
  static async detectJavaRuntimes(forceRefresh = false): Promise<JavaRuntime[]> {
    if (!forceRefresh && this.cachedRuntimes && this.cachedRuntimes.length > 0) {
      return this.cachedRuntimes;
    }

    const candidateEntries: { path: string; isDefault?: boolean }[] = [];
    const discoveredPaths = new Set<string>();

    // 0. Check workspace bin directory for portable JDKs (e.g. bin/jdk-25, bin/jdk-21)
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
    } catch {}

    // 1. Check system PATH 'java'
    candidateEntries.push({ path: 'java', isDefault: true });
    discoveredPaths.add('java');

    // 2. Check JAVA_HOME
    const javaHome = process.env.JAVA_HOME;
    if (javaHome) {
      const javaExe = path.join(javaHome, 'bin', 'java.exe');
      if (fs.existsSync(javaExe) && !discoveredPaths.has(javaExe.toLowerCase())) {
        candidateEntries.push({ path: javaExe });
        discoveredPaths.add(javaExe.toLowerCase());
      }
    }

    // 3. Scan common Windows installation directories
    const commonDirs = [
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\BellSoft',
      'C:\\Program Files\\Microsoft\\jdk',
      'C:\\Program Files\\Amazon Corretto',
      'C:\\Program Files\\Zulu',
      'C:\\Program Files (x86)\\Java'
    ];

    for (const baseDir of commonDirs) {
      if (fs.existsSync(baseDir)) {
        try {
          const subdirs = fs.readdirSync(baseDir);
          for (const sub of subdirs) {
            const candidate = path.join(baseDir, sub, 'bin', 'java.exe');
            if (fs.existsSync(candidate) && !discoveredPaths.has(candidate.toLowerCase())) {
              candidateEntries.push({ path: candidate });
              discoveredPaths.add(candidate.toLowerCase());
            }
          }
        } catch {
          // ignore directory access errors
        }
      }
    }

    // Probe all candidate paths in parallel for maximum speed (sub-second)
    const probePromises = candidateEntries.map(async (entry) => {
      try {
        const runtime = await this.probeJavaPath(entry.path);
        if (runtime) {
          if (entry.isDefault) runtime.isDefault = true;
          return runtime;
        }
      } catch {}
      return null;
    });

    const results = (await Promise.all(probePromises)).filter((r): r is JavaRuntime => r !== null);
    
    // Deduplicate by path
    const uniqueRuntimes: JavaRuntime[] = [];
    const seen = new Set<string>();
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
  static async probeJavaPath(javaExe: string): Promise<JavaRuntime | null> {
    try {
      const { stderr, stdout } = await execAsync(`"${javaExe}" -version`);
      const output = (stderr || '') + '\n' + (stdout || '');
      
      // Parse version e.g. "25.0.4", "21.0.9", "17.0.2", "1.8.0_311"
      const versionMatch = output.match(/version "([0-9._]+)"/i);
      if (!versionMatch) return null;

      const fullVersion = versionMatch[1];
      let majorVersion = 17; // fallback

      if (fullVersion.startsWith('1.')) {
        majorVersion = parseInt(fullVersion.split('.')[1], 10);
      } else {
        majorVersion = parseInt(fullVersion.split('.')[0], 10);
      }

      let vendor = 'Unknown';
      if (output.includes('Temurin') || output.includes('Adoptium')) vendor = 'Eclipse Temurin';
      else if (output.includes('OpenJDK')) vendor = 'OpenJDK';
      else if (output.includes('Oracle')) vendor = 'Oracle';
      else if (output.includes('Corretto')) vendor = 'Amazon Corretto';
      else if (output.includes('Microsoft')) vendor = 'Microsoft';
      else if (output.includes('Zulu')) vendor = 'Azul Zulu';

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
  static getRecommendedJava(mcVersion: string, available: JavaRuntime[]): JavaRuntime | null {
    if (available.length === 0) return null;

    let targetMajor = 21; // Default modern
    const parts = mcVersion.split('.');
    const major = parseInt(parts[0], 10) || 1;
    const minor = parts.length > 1 ? parseInt(parts[1], 10) : 20;
    const patch = parts.length > 2 ? parseInt(parts[2], 10) : 0;

    if (major >= 26) {
      targetMajor = 25; // 26.x requires Java 25+
    } else if (major === 1 && (minor >= 21 || (minor === 20 && patch >= 5))) {
      targetMajor = 21; // 1.20.5+ requires Java 21
    } else if (major === 1 && minor >= 18) {
      targetMajor = 17; // 1.18 - 1.20.4 requires Java 17
    } else if (major === 1 && minor >= 17) {
      targetMajor = 16;
    } else {
      targetMajor = 8;
    }

    // Try exact match, otherwise highest available >= targetMajor
    const exact = available.find(r => r.majorVersion === targetMajor);
    if (exact) return exact;

    const compatible = available.filter(r => r.majorVersion >= targetMajor);
    if (compatible.length > 0) {
      return compatible.sort((a, b) => b.majorVersion - a.majorVersion)[0];
    }

    return available[0];
  }

  /**
   * Finds java.exe inside a folder or its single sub-folder.
   */
  static findJavaInDir(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const direct = path.join(dir, 'bin', 'java.exe');
    if (fs.existsSync(direct)) return direct;

    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const candidate = path.join(dir, item, 'bin', 'java.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {}
    return null;
  }

  /**
   * Downloads and extracts portable OpenJDK (Java 25 or 21) into workspace bin.
   */
  static async downloadAndExtractPortableJdk(
    majorVersion: number = 25,
    onProgress?: (percent: number) => void
  ): Promise<string | null> {
    const binDir = AppPaths.getBinDir();
    AppPaths.ensureDir(binDir);
    const targetDir = path.join(binDir, `jdk-${majorVersion}`);
    const zipPath = path.join(binDir, `jdk-${majorVersion}.zip`);

    // Check if already extracted
    const existingJava = this.findJavaInDir(targetDir);
    if (existingJava) return existingJava;

    const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${majorVersion}/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk`;
    logger.info(`Downloading portable OpenJDK ${majorVersion} from ${downloadUrl}...`);

    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(zipPath);
      const doRequest = (url: string) => {
        https.get(url, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return doRequest(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download OpenJDK ${majorVersion}: HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (onProgress && totalBytes > 0) {
              onProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
          });

          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
        }).on('error', (err) => {
          fs.unlink(zipPath, () => {});
          reject(err);
        });
      };
      doRequest(downloadUrl);
    });

    logger.info(`Extracting OpenJDK ${majorVersion} to ${targetDir}...`);
    AppPaths.ensureDir(targetDir);

    try {
      await execAsync(`tar -xf "${zipPath}" -C "${targetDir}"`);
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      this.clearCache();
      const found = this.findJavaInDir(targetDir);
      logger.info(`OpenJDK ${majorVersion} ready at: ${found}`);
      return found;
    } catch (tarErr) {
      try {
        await execAsync(`powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${targetDir}' -Force"`);
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        this.clearCache();
        return this.findJavaInDir(targetDir);
      } catch (psErr) {
        logger.error(`Failed to extract OpenJDK ${majorVersion}`, psErr);
        return null;
      }
    }
  }

  /**
   * Downloads and launches the Java 21 JRE installer.
   */
  static async downloadAndInstallJava21(onProgress?: (percent: number) => void): Promise<boolean> {
    const downloadUrl = 'https://api.adoptium.net/v3/installer/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk';
    const tempDir = process.env.TEMP || AppPaths.getServersDir();
    const destPath = path.join(tempDir, 'OpenJDK21U-jre_x64_windows_hotspot.msi');

    logger.info(`Downloading Java 21 installer to ${destPath}`);

    // Download the MSI
    await new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      
      const doRequest = (url: string) => {
        https.get(url, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doRequest(res.headers.location);
            return;
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed to download Java: ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (onProgress && totalBytes > 0) {
              onProgress(Math.round((downloadedBytes / totalBytes) * 100));
            }
          });

          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
        }).on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      };

      doRequest(downloadUrl);
    });

    logger.info(`Launching Java installer: ${destPath}`);
    spawn('cmd.exe', ['/c', 'start', '""', destPath], { detached: true, stdio: 'ignore' });
    return true;
  }
}
