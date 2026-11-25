import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class AppPaths {
  private static baseDir: string = '';
  private static setupComplete: boolean = false;
  private static setupStep: 'directory' | 'dependencies' | 'playit' | 'complete' = 'directory';

  private static getPointerPath(): string {
    const userData = app ? app.getPath('userData') : process.cwd();
    return path.join(userData, 'workspace-pointer.json');
  }

  private static savePointer(storageDir: string, setupComplete: boolean, setupStep: string): void {
    let relativeStorageDirectory: string | undefined;

    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      try {
        const exeDir = process.env.PORTABLE_EXECUTABLE_DIR;
        const exeDrive = path.parse(path.resolve(exeDir)).root.toLowerCase();
        const storageDrive = path.parse(path.resolve(storageDir)).root.toLowerCase();
        if (exeDrive === storageDrive) {
          relativeStorageDirectory = path.relative(exeDir, storageDir);
        }
      } catch {}
    }

    const payload = JSON.stringify({
      storageDirectory: storageDir,
      relativeStorageDirectory,
      setupComplete,
      setupStep
    }, null, 2);

    // Save in userData
    try {
      const userDataPointer = this.getPointerPath();
      fs.writeFileSync(userDataPointer, payload, 'utf-8');
    } catch {}

    // Also save next to the portable executable if running portably
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      try {
        const portablePointer = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'workspace-pointer.json');
        fs.writeFileSync(portablePointer, payload, 'utf-8');
      } catch {}
    }
  }

  static init(): void {
    // Clean up any legacy Craftora folders in Roaming
    this.cleanUpRoamingFolders();

    // Check pointer file in order:
    // 1. Next to the portable executable (PORTABLE_EXECUTABLE_DIR)
    // 2. In userData (%APPDATA%\CraftTogether)
    let pointerData: any = null;

    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      const portablePointer = path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'workspace-pointer.json');
      if (fs.existsSync(portablePointer)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(portablePointer, 'utf-8'));
          if (parsed.relativeStorageDirectory) {
            const relResolved = path.resolve(process.env.PORTABLE_EXECUTABLE_DIR, parsed.relativeStorageDirectory);
            if (fs.existsSync(relResolved)) {
              parsed.storageDirectory = relResolved;
            }
          }
          pointerData = parsed;
        } catch {}
      }
    }

    if (!pointerData || !pointerData.storageDirectory || !fs.existsSync(pointerData.storageDirectory)) {
      const userDataPointer = this.getPointerPath();
      if (fs.existsSync(userDataPointer)) {
        try {
          pointerData = JSON.parse(fs.readFileSync(userDataPointer, 'utf-8'));
        } catch {}
      }
    }

    if (pointerData && pointerData.storageDirectory && fs.existsSync(pointerData.storageDirectory)) {
      try {
        const settingsPath = path.join(pointerData.storageDirectory, 'app-settings.json');
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
          this.baseDir = pointerData.storageDirectory;

          // Explicitly finished setup
          if (settings.setupStep === 'complete' && settings.setupComplete === true) {
            this.setupComplete = true;
            this.setupStep = 'complete';
            return;
          }

          // User was on playit screen
          if (settings.setupStep === 'playit') {
            this.setupComplete = false;
            this.setupStep = 'playit';
            return;
          }

          // User was on dependencies screen
          if (settings.setupStep === 'dependencies') {
            this.setupComplete = false;
            this.setupStep = 'dependencies';
            return;
          }

          const serversDir = path.join(pointerData.storageDirectory, 'servers');
          const hasServers = fs.existsSync(serversDir) && fs.readdirSync(serversDir).filter(f => {
            try { return fs.statSync(path.join(serversDir, f)).isDirectory(); } catch { return false; }
          }).length > 0;

          const playitFileName = process.platform === 'win32' ? 'playit.exe' : process.platform === 'darwin' ? 'playitd' : 'playit';
          const playitBin = path.join(pointerData.storageDirectory, 'bin', playitFileName);
          const hasPlayitBin = fs.existsSync(playitBin) && fs.statSync(playitBin).size > 1024 * 1024;

          if (!hasServers && settings.setupStep !== 'complete') {
            this.setupComplete = false;
            this.setupStep = hasPlayitBin ? 'playit' : 'dependencies';
            return;
          }

          this.setupComplete = settings.setupComplete === true;
          this.setupStep = this.setupComplete ? 'complete' : 'dependencies';
          return;
        }
      } catch (e) {
        console.error('Failed to parse workspace pointer', e);
      }
      
      this.baseDir = '';
      this.setupComplete = false;
      this.setupStep = 'directory';
    }
  }

  /**
   * Cleans up any Craftora folders or server files created in the user's Roaming folder.
   */
  static cleanUpRoamingFolders(): void {
    try {
      const appData = process.env.APPDATA;
      const currentUserData = app ? app.getPath('userData') : '';

      if (appData) {
        const legacyRoaming = path.join(appData, 'Craftora');
        if (fs.existsSync(legacyRoaming) && path.resolve(legacyRoaming).toLowerCase() !== path.resolve(currentUserData).toLowerCase()) {
          try {
            fs.rmSync(legacyRoaming, { recursive: true, force: true });
          } catch {}
        }
      }

      if (currentUserData && fs.existsSync(currentUserData)) {
        // Clean up redundant nested directory if present
        for (const legacyName of ['Craftora', 'CraftTogether']) {
          const legacyNested = path.join(currentUserData, legacyName);
          if (fs.existsSync(legacyNested)) {
            try {
              fs.rmSync(legacyNested, { recursive: true, force: true });
            } catch {}
          }
        }

        // Clean up any legacy server or jar files in userData
        const legacyServers = path.join(currentUserData, 'servers');
        if (fs.existsSync(legacyServers)) {
          try {
            fs.rmSync(legacyServers, { recursive: true, force: true });
          } catch {}
        }
      }
    } catch {}
  }

  static getSettingsFilePath(): string {
    return path.join(this.getBaseDir(), 'app-settings.json');
  }

  static getSetupStep(): 'directory' | 'dependencies' | 'playit' | 'complete' {
    if (!this.baseDir) {
      this.init();
    }
    if (!this.baseDir || !fs.existsSync(this.baseDir)) {
      return 'directory';
    }
    if (this.setupComplete) {
      return 'complete';
    }
    return this.setupStep;
  }

  static isSetupComplete(): boolean {
    if (!this.baseDir) {
      this.init();
    }
    
    if (!this.baseDir || !fs.existsSync(this.baseDir)) {
      this.setupComplete = false;
      return false;
    }

    // The chosen workspace directory MUST contain app-settings.json
    const settingsPath = path.join(this.baseDir, 'app-settings.json');
    if (!fs.existsSync(settingsPath)) {
      this.setupComplete = false;
      return false;
    }

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      // Only complete if setupComplete is true AND setupStep is 'complete'
      this.setupComplete = settings.setupComplete === true && settings.setupStep === 'complete';
      return this.setupComplete;
    } catch {
      this.setupComplete = false;
      return false;
    }
  }

  static setStorageDir(customPath: string): void {
    this.ensureDir(customPath);
    this.baseDir = customPath;

    // Check if this is an existing workspace
    const settingsPath = path.join(customPath, 'app-settings.json');
    let isExistingComplete = false;
    if (fs.existsSync(settingsPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (existing.setupComplete === true && existing.setupStep === 'complete') {
          isExistingComplete = true;
          this.setupComplete = true;
          this.setupStep = 'complete';
        }
      } catch {}
    }

    if (!isExistingComplete) {
      this.setupComplete = false;
      this.setupStep = 'dependencies';
      fs.writeFileSync(
        settingsPath,
        JSON.stringify({
          storageDirectory: customPath,
          setupComplete: false,
          setupStep: 'dependencies',
          updatedAt: new Date().toISOString()
        }, null, 2),
        'utf-8'
      );
    }

    // Save bootstrap pointer so Electron remembers the chosen directory
    this.savePointer(customPath, this.setupComplete, this.setupStep);

    // Ensure all subdirectories inside the chosen directory
    this.ensureDir(this.getServersDir());
    this.ensureDir(this.getDownloadsDir());
    this.ensureDir(this.getBackupsDir());

    // Clean up any Craftora folder in the user's Roaming directory
    this.cleanUpRoamingFolders();
  }

  static setSetupStep(step: 'directory' | 'dependencies' | 'playit' | 'complete'): void {
    this.setupStep = step;
    this.setupComplete = step === 'complete';

    if (this.baseDir && fs.existsSync(this.baseDir)) {
      const settingsPath = path.join(this.baseDir, 'app-settings.json');
      let existing: any = {};
      if (fs.existsSync(settingsPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        } catch {}
      }

      fs.writeFileSync(
        settingsPath,
        JSON.stringify({
          ...existing,
          storageDirectory: this.baseDir,
          setupComplete: this.setupComplete,
          setupStep: this.setupStep,
          updatedAt: new Date().toISOString()
        }, null, 2),
        'utf-8'
      );

      this.savePointer(this.baseDir, this.setupComplete, this.setupStep);
    }
  }

  static completeSetup(): void {
    this.setSetupStep('complete');
  }

  /**
   * Validates if a target directory exists and is either strictly EMPTY or an EXISTING CraftTogether workspace.
   */
  static validateDirectory(targetPath: string): { isValid: boolean; isEmpty: boolean; isExistingWorkspace?: boolean; error?: string; path: string } {
    if (!targetPath || !targetPath.trim()) {
      return { isValid: false, isEmpty: false, error: 'Please specify a folder path.', path: targetPath };
    }

    const resolved = path.resolve(targetPath.trim());

    if (!fs.existsSync(resolved)) {
      return { isValid: true, isEmpty: true, path: resolved };
    }

    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return { isValid: false, isEmpty: false, error: 'The selected path is a file, not a directory.', path: resolved };
      }

      // Check if this directory is already an existing CraftTogether workspace
      const settingsPath = path.join(resolved, 'app-settings.json');
      if (fs.existsSync(settingsPath)) {
        return { isValid: true, isEmpty: true, isExistingWorkspace: true, path: resolved };
      }

      const files = fs.readdirSync(resolved);
      if (files.length > 0) {
        return {
          isValid: false,
          isEmpty: false,
          error: 'The selected folder is not empty. Please select an empty folder or an existing CraftTogether directory.',
          path: resolved
        };
      }

      return { isValid: true, isEmpty: true, path: resolved };
    } catch (e: any) {
      return { isValid: false, isEmpty: false, error: `Cannot access folder: ${e.message}`, path: resolved };
    }
  }

  static getBaseDir(): string {
    if (!this.baseDir) this.init();
    return this.baseDir || 'C:\\CraftTogetherServers';
  }

  static getServersDir(): string {
    return path.join(this.getBaseDir(), 'servers');
  }

  static getDownloadsDir(): string {
    return path.join(this.getBaseDir(), 'downloads');
  }

  static getBackupsDir(): string {
    return path.join(this.getBaseDir(), 'backups');
  }

  static getServerPath(serverId: string): string {
    const sPath = path.join(this.getServersDir(), serverId);
    this.ensureDir(sPath);
    return sPath;
  }

  static getBinDir(): string {
    return path.join(this.getBaseDir(), 'bin');
  }

  static getPluginsCacheDir(): string {
    return path.join(this.getDownloadsDir(), 'plugins');
  }

  static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
