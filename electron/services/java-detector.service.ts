import { exec, execFile, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import https from 'https';
import { AppPaths } from '../utils/paths';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const logger = new Logger('JavaDetector');

// Standard OLE Compound Binary File header shared by all valid Windows .msi installers
const MSI_MAGIC_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const MIN_VALID_MSI_BYTES = 10 * 1024 * 1024; // Temurin 21 JRE MSI is ~40-50 MB

export interface JavaRuntime {
  path: string;
  version: string;
  majorVersion: number;
  isDefault: boolean;
  vendor: string;
}

interface InternalJavaRuntime extends JavaRuntime {
  is64Bit: boolean;
}

export class JavaDetectorService {
  private static cachedRuntimes: JavaRuntime[] | null = null;
  private static activeJavaInstallPromise: Promise<boolean> | null = null;

  static clearCache(): void {
    this.cachedRuntimes = null;
  }

  private static getJavaExeName(): string {
    return process.platform === 'win32' ? 'java.exe' : 'java';
  }

  private static getAdoptiumArch(): string {
    return process.arch === 'arm64' ? 'aarch64' : 'x64';
  }

  private static getRegExePath(): string {
    if (process.env.SystemRoot) {
      const sysReg = path.join(process.env.SystemRoot, 'System32', 'reg.exe');
      if (fs.existsSync(sysReg)) return sysReg;
    }
    return 'reg.exe';
  }

  private static getMsiExecPath(): string {
    if (process.env.SystemRoot) {
      const sysMsi = path.join(process.env.SystemRoot, 'System32', 'msiexec.exe');
      if (fs.existsSync(sysMsi)) return sysMsi;
    }
    return 'msiexec.exe';
  }

  private static async runRegQuery(args: string[]): Promise<string> {
    if (process.platform !== 'win32') return '';
    try {
      const { stdout } = await execFileAsync(this.getRegExePath(), ['query', ...args], {
        windowsHide: true,
        timeout: 4500,
        maxBuffer: 4 * 1024 * 1024
      });
      return stdout || '';
    } catch {
      return '';
    }
  }

  private static expandWindowsEnvVars(value: string): string {
    if (!value || !value.includes('%')) return value;
    const envLower = new Map<string, string>();
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) envLower.set(k.toLowerCase(), v);
    }
    return value.replace(/%([^%]+)%/g, (match, varName: string) => {
      const resolved = envLower.get(varName.toLowerCase());
      return resolved !== undefined ? resolved : match;
    });
  }

  /**
   * Extracts string registry value data from `reg.exe query` output.
   */
  private static parseRegValues(output: string, allowedNames?: string[]): string[] {
    if (!output) return [];
    const allowedSet = allowedNames ? new Set(allowedNames.map(n => n.toLowerCase())) : null;
    const results: string[] = [];
    const lines = output.split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(/^\s+([^\s]+)\s+REG_(?:EXPAND_)?SZ\s+(.+)$/i);
      if (!match) continue;
      const name = match[1].trim();
      if (allowedSet && !allowedSet.has(name.toLowerCase())) continue;

      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1).trim();
      }
      if (value) {
        results.push(this.expandWindowsEnvVars(value));
      }
    }

    return results;
  }

  /**
   * Reads fresh PATH and JAVA_HOME values directly from the Windows Registry
   * so newly installed Java runtimes are detected immediately without restarting the app.
   */
  private static async getFreshWindowsEnvironment(): Promise<{ pathEntries: string[]; javaHomes: string[] }> {
    const pathEntries: string[] = [];
    const javaHomes: string[] = [];
    const seenPaths = new Set<string>();
    const seenHomes = new Set<string>();

    const addPathSegment = (raw: string) => {
      for (const segment of raw.split(path.delimiter)) {
        const cleaned = segment.trim().replace(/^"+|"+$/g, '');
        if (!cleaned) continue;
        const expanded = this.expandWindowsEnvVars(cleaned);
        const key = expanded.toLowerCase();
        if (!seenPaths.has(key)) {
          seenPaths.add(key);
          pathEntries.push(expanded);
        }
      }
    };

    const addJavaHome = (raw: string) => {
      const cleaned = raw.trim().replace(/^"+|"+$/g, '');
      if (!cleaned) return;
      const expanded = this.expandWindowsEnvVars(cleaned);
      const key = expanded.toLowerCase();
      if (!seenHomes.has(key)) {
        seenHomes.add(key);
        javaHomes.push(expanded);
      }
    };

    if (process.platform === 'win32') {
      const [hklmPathOut, hkcuPathOut, hklmHomeOut, hkcuHomeOut] = await Promise.all([
        this.runRegQuery(['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'Path']),
        this.runRegQuery(['HKCU\\Environment', '/v', 'Path']),
        this.runRegQuery(['HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'JAVA_HOME']),
        this.runRegQuery(['HKCU\\Environment', '/v', 'JAVA_HOME'])
      ]);

      for (const val of this.parseRegValues(hklmPathOut, ['Path'])) addPathSegment(val);
      for (const val of this.parseRegValues(hkcuPathOut, ['Path'])) addPathSegment(val);
      for (const val of this.parseRegValues(hklmHomeOut, ['JAVA_HOME'])) addJavaHome(val);
      for (const val of this.parseRegValues(hkcuHomeOut, ['JAVA_HOME'])) addJavaHome(val);
    }

    if (process.env.PATH) addPathSegment(process.env.PATH);
    if (process.env.JAVA_HOME) addJavaHome(process.env.JAVA_HOME);

    return { pathEntries, javaHomes };
  }

  /**
   * Queries Windows Registry Java vendor keys and MSI Uninstall InstallLocation entries.
   * Discovers Java runtimes even when installed to custom directories or non-C: drives,
   * and even if the user unchecked "Add to PATH" or "Set JAVA_HOME" in the installer.
   */
  private static async discoverRegistryJavaDirs(): Promise<string[]> {
    if (process.platform !== 'win32') return [];

    const vendorKeys = [
      'HKLM\\SOFTWARE\\Eclipse Adoptium',
      'HKCU\\SOFTWARE\\Eclipse Adoptium',
      'HKLM\\SOFTWARE\\JavaSoft',
      'HKLM\\SOFTWARE\\AdoptOpenJDK',
      'HKLM\\SOFTWARE\\Microsoft\\JDK',
      'HKLM\\SOFTWARE\\Azul Systems',
      'HKLM\\SOFTWARE\\BellSoft',
      'HKLM\\SOFTWARE\\Amazon',
      'HKLM\\SOFTWARE\\IBM\\Semeru',
      'HKLM\\SOFTWARE\\SapMachine',
      'HKLM\\SOFTWARE\\WOW6432Node\\Eclipse Adoptium',
      'HKLM\\SOFTWARE\\WOW6432Node\\JavaSoft'
    ];

    const uninstallKeys = [
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    ];

    const [vendorOutputs, uninstallOutputs] = await Promise.all([
      Promise.all(vendorKeys.map(key => this.runRegQuery([key, '/s']))),
      Promise.all(uninstallKeys.map(key => this.runRegQuery([key, '/s', '/v', 'InstallLocation'])))
    ]);

    const dirs: string[] = [];
    const seen = new Set<string>();

    const addDir = (raw: string) => {
      const cleaned = raw.trim().replace(/^"+|"+$/g, '').replace(/[\\/]+$/, '');
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dirs.push(cleaned);
      }
    };

    for (const out of vendorOutputs) {
      for (const val of this.parseRegValues(out, ['Path', 'JavaHome', 'InstallPath', 'InstallationPath', 'Home'])) {
        addDir(val);
      }
    }

    for (const out of uninstallOutputs) {
      for (const val of this.parseRegValues(out, ['InstallLocation'])) {
        addDir(val);
      }
    }

    return dirs;
  }

  /**
   * Builds the list of common Windows Java installation parent folders using
   * dynamic environment roots (ProgramFiles, LOCALAPPDATA, SystemDrive) so
   * non-C: installs and per-user installs are covered too.
   */
  private static getCommonInstallParentDirs(): string[] {
    if (process.platform === 'darwin') {
      const home = os.homedir();
      return [
        '/Library/Java/JavaVirtualMachines',
        path.join(home, 'Library', 'Java', 'JavaVirtualMachines'),
        '/opt/homebrew/opt',
        '/usr/local/opt',
        path.join(home, '.sdkman', 'candidates', 'java'),
        path.join(home, '.jdks')
      ];
    }

    if (process.platform !== 'win32') {
      const home = os.homedir();
      return [
        '/usr/lib/jvm',
        path.join(home, '.sdkman', 'candidates', 'java'),
        path.join(home, '.jdks')
      ];
    }

    const programFilesRoots = new Set<string>();
    const pf = process.env.ProgramFiles;
    const pf86 = process.env['ProgramFiles(x86)'];
    const localAppData = process.env.LOCALAPPDATA;
    const userProfile = process.env.USERPROFILE;
    const sysDrive = process.env.SystemDrive || 'C:';

    if (pf) programFilesRoots.add(pf);
    programFilesRoots.add('C:\\Program Files');

    const vendorSubdirs = [
      'Eclipse Adoptium',
      'Java',
      'Microsoft',
      'Amazon Corretto',
      'BellSoft',
      'Zulu',
      'AdoptOpenJDK',
      'Eclipse Foundation',
      'Semeru',
      'OpenJDK',
      'SapMachine',
      'GraalVM',
      'Oracle'
    ];

    const dirs: string[] = [];
    const seen = new Set<string>();
    const add = (dir: string) => {
      const key = dir.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        dirs.push(dir);
      }
    };

    for (const root of programFilesRoots) {
      for (const vendor of vendorSubdirs) {
        add(path.join(root, vendor));
      }
    }

    if (pf86) {
      add(path.join(pf86, 'Eclipse Adoptium'));
      add(path.join(pf86, 'Java'));
    }
    add('C:\\Program Files (x86)\\Eclipse Adoptium');
    add('C:\\Program Files (x86)\\Java');

    if (localAppData) {
      add(path.join(localAppData, 'Programs', 'Eclipse Adoptium'));
      add(path.join(localAppData, 'Programs', 'Adoptium'));
      add(path.join(localAppData, 'Programs', 'Java'));
    }

    if (userProfile) {
      add(path.join(userProfile, '.jdks'));
    }

    add(path.join(`${sysDrive}\\`, 'Java'));
    return dirs;
  }

  /**
   * Prepends a verified Java executable's bin directory to the running Electron process PATH
   * so subsequent child processes invoking `java` work immediately without restarting the app.
   */
  static injectJavaIntoProcessPath(javaExePath: string): void {
    if (!javaExePath || javaExePath.toLowerCase() === 'java') return;
    try {
      const binDir = path.dirname(path.resolve(javaExePath));
      if (!fs.existsSync(binDir)) return;
      const currentPath = process.env.PATH || '';
      const segments = currentPath.split(path.delimiter).map(s => s.trim().toLowerCase());
      if (!segments.includes(binDir.toLowerCase())) {
        process.env.PATH = currentPath ? `${binDir}${path.delimiter}${currentPath}` : binDir;
        logger.info(`Updated process PATH with Java bin directory: ${binDir}`);
      }
    } catch {}
  }

  /**
   * Discovers all available Java runtimes on the Windows host and in workspace bin.
   * Cached in-memory unless `forceRefresh` is true.
   */
  static async detectJavaRuntimes(forceRefresh = false): Promise<JavaRuntime[]> {
    if (!forceRefresh && this.cachedRuntimes && this.cachedRuntimes.length > 0) {
      return this.cachedRuntimes;
    }

    const candidateEntries: { path: string; isDefault: boolean }[] = [];
    const discoveredCanonical = new Map<string, number>();

    const addCandidate = (javaExePath: string, isDefault = false) => {
      if (!javaExePath) return;
      const isBareCommand = javaExePath.toLowerCase() === 'java';
      let normalized = javaExePath;
      let canonicalKey = javaExePath.toLowerCase();

      if (!isBareCommand) {
        normalized = path.resolve(javaExePath);
        if (!fs.existsSync(normalized)) return;
        try {
          canonicalKey = fs.realpathSync(normalized).toLowerCase();
        } catch {
          canonicalKey = normalized.toLowerCase();
        }
      }

      const existingIdx = discoveredCanonical.get(canonicalKey);
      if (existingIdx !== undefined) {
        if (isDefault) candidateEntries[existingIdx].isDefault = true;
        return;
      }

      discoveredCanonical.set(canonicalKey, candidateEntries.length);
      candidateEntries.push({ path: normalized, isDefault });
    };

    const exeName = this.getJavaExeName();

    const addFromDir = (dir: string, isDefault = false) => {
      if (!dir) return;
      const directExe = path.join(dir, exeName);
      if (fs.existsSync(directExe)) {
        addCandidate(directExe, isDefault);
      }
      const binExe = path.join(dir, 'bin', exeName);
      if (fs.existsSync(binExe)) {
        addCandidate(binExe, isDefault);
      }
      const macBundleExe = path.join(dir, 'Contents', 'Home', 'bin', exeName);
      if (fs.existsSync(macBundleExe)) {
        addCandidate(macBundleExe, isDefault);
      }
    };

    // 0. Check workspace bin directory for portable JDKs (e.g. bin/jdk-25, bin/jdk-21)
    try {
      const binDir = AppPaths.getBinDir();
      if (fs.existsSync(binDir)) {
        const subdirs = fs.readdirSync(binDir);
        for (const sub of subdirs) {
          const subPath = path.join(binDir, sub);
          const found = this.findJavaInDir(subPath);
          if (found) addCandidate(found);
        }
      }
    } catch {}

    // 1 & 2. Query fresh Windows Registry PATH/JAVA_HOME and vendor/Uninstall registry keys in parallel
    const [freshEnv, registryDirs] = await Promise.all([
      this.getFreshWindowsEnvironment(),
      this.discoverRegistryJavaDirs()
    ]);

    // Check every directory in the refreshed System + User PATH
    let foundDefaultOnPath = false;
    for (const dir of freshEnv.pathEntries) {
      const exeName = process.platform === 'win32' ? 'java.exe' : 'java';
      const candidate = path.join(dir, exeName);
      if (fs.existsSync(candidate)) {
        addCandidate(candidate, !foundDefaultOnPath);
        foundDefaultOnPath = true;
      }
    }

    // Check fresh JAVA_HOME locations
    for (const javaHome of freshEnv.javaHomes) {
      addFromDir(javaHome);
    }

    // Check every directory discovered via Windows Registry (Eclipse Adoptium, JavaSoft, MSI Uninstall, etc.)
    for (const regDir of registryDirs) {
      addFromDir(regDir);
    }

    // 3. Scan common Windows installation directories
    const commonDirs = this.getCommonInstallParentDirs();
    for (const baseDir of commonDirs) {
      if (!fs.existsSync(baseDir)) continue;
      try {
        addFromDir(baseDir);
        const subdirs = fs.readdirSync(baseDir);
        for (const sub of subdirs) {
          const subPath = path.join(baseDir, sub);
          const directCandidate = path.join(subPath, 'bin', exeName);
          const macCandidate = path.join(subPath, 'Contents', 'Home', 'bin', exeName);
          if (fs.existsSync(directCandidate)) {
            addCandidate(directCandidate);
          } else if (fs.existsSync(macCandidate)) {
            addCandidate(macCandidate);
          } else {
            const nested = this.findJavaInDir(subPath);
            if (nested) addCandidate(nested);
          }
        }
      } catch {
        // Ignore directory permission errors
      }
    }

    // 4. Fallback to bare 'java' command ONLY if no concrete PATH binary was found
    if (!foundDefaultOnPath) {
      addCandidate('java', true);
    }

    // Probe all candidate paths in parallel using direct execFile (no cmd.exe shell)
    const freshPathEnv = freshEnv.pathEntries.length > 0 ? freshEnv.pathEntries.join(path.delimiter) : process.env.PATH;
    const probePromises = candidateEntries.map(async (entry): Promise<InternalJavaRuntime | null> => {
      try {
        const runtime = await this.probeJavaPathInternal(entry.path, freshPathEnv);
        if (runtime) {
          if (entry.isDefault) runtime.isDefault = true;
          return runtime;
        }
      } catch {}
      return null;
    });

    const results = (await Promise.all(probePromises)).filter((r): r is InternalJavaRuntime => r !== null);

    // Sort: 64-bit first, highest major version first, concrete paths over bare 'java', default first
    results.sort((a, b) => {
      if (a.is64Bit !== b.is64Bit) return a.is64Bit ? -1 : 1;
      if (a.majorVersion !== b.majorVersion) return b.majorVersion - a.majorVersion;
      const aBare = a.path.toLowerCase() === 'java';
      const bBare = b.path.toLowerCase() === 'java';
      if (aBare !== bBare) return aBare ? 1 : -1;
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return b.version.localeCompare(a.version, undefined, { numeric: true });
    });

    // Deduplicate by normalized path
    const uniqueRuntimes: JavaRuntime[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      const normalized = r.path.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueRuntimes.push({
          path: r.path,
          version: r.version,
          majorVersion: r.majorVersion,
          isDefault: r.isDefault,
          vendor: r.vendor
        });
      }
    }

    // Keep current Electron process PATH synced if a Java 21+ runtime was found
    const bestJava21 = uniqueRuntimes.find(r => r.majorVersion >= 21 && r.path.toLowerCase() !== 'java');
    if (bestJava21) {
      this.injectJavaIntoProcessPath(bestJava21.path);
    }

    this.cachedRuntimes = uniqueRuntimes;
    logger.info(`Detected ${uniqueRuntimes.length} Java runtime(s): ${uniqueRuntimes.map(r => `${r.version} (${r.vendor}) @ ${r.path}`).join('; ') || 'none'}`);
    return uniqueRuntimes;
  }

  /**
   * Finds and verifies a working Java runtime meeting `minMajorVersion`.
   */
  static async findVerifiedJava(minMajorVersion = 21, forceRefresh = true): Promise<JavaRuntime | null> {
    if (forceRefresh) {
      this.clearCache();
    }
    const runtimes = await this.detectJavaRuntimes(forceRefresh);
    return runtimes.find(r => r.majorVersion >= minMajorVersion) || null;
  }

  /**
   * Runs `java -version` directly via execFile (bypassing cmd.exe) and parses version metadata.
   */
  private static async probeJavaPathInternal(javaExe: string, overridePath?: string): Promise<InternalJavaRuntime | null> {
    try {
      const env = overridePath ? { ...process.env, PATH: overridePath } : process.env;
      const { stderr, stdout } = await execFileAsync(javaExe, ['-version'], {
        windowsHide: true,
        timeout: 8000,
        env
      });
      const output = `${stderr || ''}\n${stdout || ''}`;

      // Handles "21.0.12.1", "21.0.6+7", "21-ea", "25.0.1-LTS", "1.8.0_311", etc.
      const versionMatch = output.match(/version\s+"([^"]+)"/i);
      if (!versionMatch) return null;

      const fullVersion = versionMatch[1].trim();
      let majorVersion = 0;

      const legacyMatch = fullVersion.match(/^1\.(\d+)/);
      const modernMatch = fullVersion.match(/^(\d+)/);
      if (legacyMatch) {
        majorVersion = parseInt(legacyMatch[1], 10);
      } else if (modernMatch) {
        majorVersion = parseInt(modernMatch[1], 10);
      }

      if (!majorVersion || Number.isNaN(majorVersion)) return null;

      let vendor = 'Unknown';
      if (output.includes('Temurin') || output.includes('Adoptium')) vendor = 'Eclipse Temurin';
      else if (output.includes('Corretto')) vendor = 'Amazon Corretto';
      else if (output.includes('Microsoft')) vendor = 'Microsoft';
      else if (output.includes('Zulu')) vendor = 'Azul Zulu';
      else if (output.includes('Liberica') || output.includes('BellSoft')) vendor = 'BellSoft Liberica';
      else if (output.includes('Semeru')) vendor = 'IBM Semeru';
      else if (output.includes('GraalVM')) vendor = 'GraalVM';
      else if (output.includes('OpenJDK')) vendor = 'OpenJDK';
      else if (output.includes('Java(TM)') || output.includes('Oracle')) vendor = 'Oracle';

      const is64Bit = /64-bit/i.test(output) || (!/32-bit|x86/i.test(output) && !javaExe.toLowerCase().includes('program files (x86)'));

      return {
        path: javaExe,
        version: fullVersion,
        majorVersion,
        isDefault: false,
        vendor,
        is64Bit
      };
    } catch {
      return null;
    }
  }

  /**
   * Runs `java -version` on a given executable path and parses version string.
   */
  static async probeJavaPath(javaExe: string): Promise<JavaRuntime | null> {
    const internal = await this.probeJavaPathInternal(javaExe);
    if (!internal) return null;
    return {
      path: internal.path,
      version: internal.version,
      majorVersion: internal.majorVersion,
      isDefault: internal.isDefault,
      vendor: internal.vendor
    };
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
   * Finds java executable inside a folder or its immediate sub-folders (supports Windows and macOS .jdk bundle layout).
   */
  static findJavaInDir(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    const exeName = this.getJavaExeName();
    const direct = path.join(dir, 'bin', exeName);
    if (fs.existsSync(direct)) return direct;
    const macDirect = path.join(dir, 'Contents', 'Home', 'bin', exeName);
    if (fs.existsSync(macDirect)) return macDirect;

    try {
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) return null;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const candidate = path.join(dir, item, 'bin', exeName);
        if (fs.existsSync(candidate)) return candidate;
        const macCandidate = path.join(dir, item, 'Contents', 'Home', 'bin', exeName);
        if (fs.existsSync(macCandidate)) return macCandidate;
      }
    } catch {}
    return null;
  }

  /**
   * Validates that a file on disk is a non-truncated Windows MSI package.
   */
  private static isValidMsiFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size < MIN_VALID_MSI_BYTES) return false;

      const fd = fs.openSync(filePath, 'r');
      try {
        const header = Buffer.alloc(8);
        const bytesRead = fs.readSync(fd, header, 0, 8, 0);
        return bytesRead === 8 && header.equals(MSI_MAGIC_HEADER);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return false;
    }
  }

  /**
   * Downloads an HTTPS URL to a `.part` file and atomically renames it to `destPath`.
   */
  private static downloadFileAtomic(
    downloadUrl: string,
    destPath: string,
    onPercent?: (percent: number) => void
  ): Promise<void> {
    const partPath = `${destPath}.part`;
    try {
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    } catch {}

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        try {
          if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
        } catch {}
        reject(err);
      };

      const doRequest = (url: string, redirectsRemaining = 10) => {
        if (redirectsRemaining <= 0) {
          return fail(new Error('Too many redirects while downloading Java 21 installer'));
        }

        const req = https.get(url, { timeout: 30000 }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            const nextUrl = new URL(res.headers.location, url).toString();
            return doRequest(nextUrl, redirectsRemaining - 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            return fail(new Error(`Failed to download Java 21 installer: HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let downloadedBytes = 0;
          const file = fs.createWriteStream(partPath);

          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            if (onPercent && totalBytes > 0) {
              onPercent(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
            }
          });

          res.on('error', (err) => {
            file.destroy();
            fail(err);
          });

          file.on('error', (err) => {
            res.destroy();
            fail(err);
          });

          res.pipe(file);

          file.on('finish', () => {
            file.close((closeErr) => {
              if (closeErr) return fail(closeErr);
              if (totalBytes > 0 && downloadedBytes < totalBytes) {
                return fail(new Error(`Incomplete Java installer download (${downloadedBytes}/${totalBytes} bytes)`));
              }
              try {
                if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                fs.renameSync(partPath, destPath);
                if (!settled) {
                  settled = true;
                  resolve();
                }
              } catch (renameErr: any) {
                fail(renameErr);
              }
            });
          });
        });

        req.on('timeout', () => {
          req.destroy(new Error('Timed out while downloading Java 21 installer'));
        });

        req.on('error', (err) => fail(err));
      };

      doRequest(downloadUrl);
    });
  }

  /**
   * Launches Windows Installer (`msiexec.exe /i`) directly and waits until
   * the user completes or closes the setup wizard.
   */
  private static runMsiInstaller(msiPath: string): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const msiExec = this.getMsiExecPath();
      logger.info(`Spawning Windows Installer: "${msiExec}" /i "${msiPath}"`);

      const child = spawn(msiExec, ['/i', msiPath], {
        stdio: 'ignore',
        windowsHide: false
      });

      child.on('error', (err) => {
        logger.error('Failed to spawn msiexec.exe', err);
        reject(err);
      });

      child.on('close', (code) => {
        const exitCode = code ?? -1;
        logger.info(`Java MSI installer exited with code ${exitCode}`);
        resolve(exitCode);
      });
    });
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
    const isWin = process.platform === 'win32';
    const adoptiumOs = isWin ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux';
    const adoptiumArch = this.getAdoptiumArch();
    const archiveExt = isWin ? 'zip' : 'tar.gz';
    const archivePath = path.join(binDir, `jdk-${majorVersion}.${archiveExt}`);

    // Check if already extracted
    const existingJava = this.findJavaInDir(targetDir);
    if (existingJava) return existingJava;

    const downloadUrl = `https://api.adoptium.net/v3/binary/latest/${majorVersion}/ga/${adoptiumOs}/${adoptiumArch}/jdk/hotspot/normal/eclipse?project=jdk`;
    logger.info(`Downloading portable OpenJDK ${majorVersion} (${adoptiumOs}/${adoptiumArch}) from ${downloadUrl}...`);

    await this.downloadFileAtomic(downloadUrl, archivePath, onProgress);

    logger.info(`Extracting OpenJDK ${majorVersion} to ${targetDir}...`);
    AppPaths.ensureDir(targetDir);

    try {
      if (isWin) {
        await execAsync(`tar -xf "${archivePath}" -C "${targetDir}"`);
      } else {
        await execFileAsync('tar', ['-xzf', archivePath, '-C', targetDir]);
      }
      if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
      this.clearCache();
      const found = this.findJavaInDir(targetDir);
      if (found && !isWin) {
        try { fs.chmodSync(found, 0o755); } catch {}
      }
      logger.info(`OpenJDK ${majorVersion} ready at: ${found}`);
      return found;
    } catch (err) {
      if (isWin) {
        try {
          await execAsync(`powershell -Command "Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${targetDir}' -Force"`);
          if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
          this.clearCache();
          return this.findJavaInDir(targetDir);
        } catch (psErr) {
          logger.error(`Failed to extract OpenJDK ${majorVersion}`, psErr);
          return null;
        }
      }
      logger.error(`Failed to extract OpenJDK ${majorVersion}`, err);
      return null;
    }
  }

  /**
   * Downloads and installs Java 21 JRE:
   * - On macOS / Linux: downloads portable Temurin 21 JRE `.tar.gz` into workspace `bin/jre-21` (no admin/sudo needed).
   * - On Windows: downloads Temurin 21 JRE MSI installer, waits for user setup, and verifies.
   */
  static async downloadAndInstallJava21(
    onProgress?: (percent: number, message?: string) => void
  ): Promise<boolean> {
    if (this.activeJavaInstallPromise) {
      logger.warn('Java 21 installation already in progress — reusing active operation');
      return this.activeJavaInstallPromise;
    }

    const run = async (): Promise<boolean> => {
      // 1. Pre-check: never redownload or reopen setup if Java 21+ is already installed and verified
      onProgress?.(5, 'Checking for existing Java 21 installation...');
      const alreadyInstalled = await this.findVerifiedJava(21, true);
      if (alreadyInstalled) {
        logger.info(`Java ${alreadyInstalled.version} already installed at ${alreadyInstalled.path}; skipping installer.`);
        this.injectJavaIntoProcessPath(alreadyInstalled.path);
        onProgress?.(100, `Java ${alreadyInstalled.version} is already installed!`);
        return true;
      }

      // macOS / Linux: silent portable Temurin 21 JRE extraction into workspace bin/jre-21
      if (process.platform !== 'win32') {
        const adoptiumOs = process.platform === 'darwin' ? 'mac' : 'linux';
        const adoptiumArch = this.getAdoptiumArch();
        const binDir = AppPaths.getBinDir();
        AppPaths.ensureDir(binDir);
        const targetDir = path.join(binDir, 'jre-21');
        const archivePath = path.join(binDir, `OpenJDK21U-jre_${adoptiumArch}_${adoptiumOs}.tar.gz`);
        const downloadUrl = `https://api.adoptium.net/v3/binary/latest/21/ga/${adoptiumOs}/${adoptiumArch}/jre/hotspot/normal/eclipse?project=jdk`;

        logger.info(`Downloading portable Java 21 JRE (${adoptiumOs}/${adoptiumArch}) to ${archivePath}`);
        onProgress?.(10, `Downloading Java 21 (${adoptiumArch})...`);
        await this.downloadFileAtomic(downloadUrl, archivePath, (downloadPct) => {
          const mappedPct = 10 + Math.round(downloadPct * 0.7); // 10% -> 80%
          onProgress?.(mappedPct, `Downloading Java 21... ${downloadPct}%`);
        });

        onProgress?.(85, 'Extracting Java 21 runtime...');
        if (fs.existsSync(targetDir)) {
          try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch {}
        }
        AppPaths.ensureDir(targetDir);
        await execFileAsync('tar', ['-xzf', archivePath, '-C', targetDir]);
        try { if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath); } catch {}

        const foundJava = this.findJavaInDir(targetDir);
        if (foundJava) {
          try { fs.chmodSync(foundJava, 0o755); } catch {}
          if (process.platform === 'darwin') {
            try { await execFileAsync('xattr', ['-dr', 'com.apple.quarantine', targetDir]); } catch {}
          }
        }

        onProgress?.(95, 'Verifying Java 21 installation...');
        const verified = await this.findVerifiedJava(21, true);
        if (verified) {
          this.injectJavaIntoProcessPath(verified.path);
          onProgress?.(100, `Java ${verified.version} installed & verified!`);
          return true;
        }

        onProgress?.(0, 'Failed to verify extracted Java 21 runtime. Please try again.');
        return false;
      }

      const downloadUrl = 'https://api.adoptium.net/v3/installer/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk';
      const tempDir = process.env.TEMP || AppPaths.getDownloadsDir();
      AppPaths.ensureDir(tempDir);
      const destPath = path.join(tempDir, 'OpenJDK21U-jre_x64_windows_hotspot.msi');

      // 2. Reuse a valid previously downloaded MSI (e.g. if user cancelled and retried) or download fresh
      if (this.isValidMsiFile(destPath)) {
        logger.info(`Reusing verified cached Java 21 MSI installer at ${destPath}`);
        onProgress?.(75, 'Installer ready — launching Java 21 Setup...');
      } else {
        logger.info(`Downloading Java 21 installer to ${destPath}`);
        onProgress?.(10, 'Downloading Java 21 installer...');
        await this.downloadFileAtomic(downloadUrl, destPath, (downloadPct) => {
          const mappedPct = 10 + Math.round(downloadPct * 0.65); // 10% -> 75%
          onProgress?.(mappedPct, `Downloading Java 21 installer... ${downloadPct}%`);
        });

        if (!this.isValidMsiFile(destPath)) {
          try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch {}
          throw new Error('Downloaded Java installer file was corrupted or incomplete.');
        }
      }

      // 3. Launch msiexec directly and wait for the installer wizard to finish
      onProgress?.(80, 'Java Setup opened — complete the installer wizard to continue...');
      const exitCode = await this.runMsiInstaller(destPath);

      if (exitCode === 1618) {
        onProgress?.(0, 'Another Windows installer is already running. Finish it and try again.');
        return false;
      }

      // 4. Post-install verification (with short retries to allow Windows Registry / antivirus flush)
      onProgress?.(90, 'Verifying Java 21 installation...');
      const maxAttempts = exitCode === 1602 ? 1 : 6; // User cancelled (1602): check once in case Java was already present

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const verified = await this.findVerifiedJava(21, true);
        if (verified) {
          logger.info(`Verified Java ${verified.version} (${verified.vendor}) at ${verified.path} on attempt ${attempt}`);
          this.injectJavaIntoProcessPath(verified.path);
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          } catch {}
          onProgress?.(100, `Java ${verified.version} installed & verified!`);
          return true;
        }

        if (attempt < maxAttempts) {
          onProgress?.(90 + Math.min(8, attempt), `Verifying Java 21 installation (attempt ${attempt + 1}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }

      if (exitCode === 1602) {
        logger.info('User cancelled Java 21 installer and no Java 21 runtime was detected.');
        onProgress?.(0, 'Java setup was cancelled. Click Download Java to try again.');
        return false;
      }

      logger.warn(`Java 21 installer exited with code ${exitCode}, but no working Java 21+ runtime was detected after ${maxAttempts} verification attempts.`);
      onProgress?.(0, `Java 21 was not detected after setup (exit code ${exitCode}). Click Refresh if installed, or try again.`);
      return false;
    };

    this.activeJavaInstallPromise = run().finally(() => {
      this.activeJavaInstallPromise = null;
    });

    return this.activeJavaInstallPromise;
  }
}
