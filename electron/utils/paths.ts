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

  static init(): void {
    // Clean up any legacy Craftora folders in Roaming
    this.cleanUpRoamingFolders();

    // Read saved storage directory from workspace pointer
    const pointerPath = this.getPointerPath();
    if (fs.existsSync(pointerPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(pointerPath, 'utf-8'));
        if (data.storageDirectory && fs.existsSync(data.storageDirectory)) {
          const settingsPath = path.join(data.storageDirectory, 'app-settings.json');
          if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            this.baseDir = data.storageDirectory;

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

            // Migration heuristic for legacy files where setupStep was not saved:
            // If no servers have been created yet and setupStep was not explicitly 'complete',
            // this user was mid-setup. Resume from playit if playit binary is present, else dependencies.
            const serversDir = path.join(data.storageDirectory, 'servers');
            const hasServers = fs.existsSync(serversDir) && fs.readdirSync(serversDir).filter(f => {
              try { return fs.statSync(path.join(serversDir, f)).isDirectory(); } catch { return false; }
            }).length > 0;

            const playitBin = path.join(data.storageDirectory, 'bin', 'playit.exe');
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
        }
      } catch (e) {
        console.error('Failed to parse workspace pointer', e);
      }
      
      // If the directory was emptied or app-settings.json is missing, invalidate setup
      try {
        if (fs.existsSync(pointerPath)) fs.unlinkSync(pointerPath);
      } catch {}
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
    this.setupComplete = false;
    this.setupStep = 'dependencies';

    // Save app settings inside the chosen directory with setupStep = dependencies
    const settingsPath = path.join(customPath, 'app-settings.json');
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

    // Save bootstrap pointer so Electron remembers the chosen directory and step
    const pointerPath = this.getPointerPath();
    fs.writeFileSync(
      pointerPath,
      JSON.stringify({
        storageDirectory: customPath,
        setupComplete: false,
        setupStep: 'dependencies'
      }, null, 2),
      'utf-8'
    );

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

      const pointerPath = this.getPointerPath();
      fs.writeFileSync(
        pointerPath,
        JSON.stringify({
          storageDirectory: this.baseDir,
          setupComplete: this.setupComplete,
          setupStep: this.setupStep
        }, null, 2),
        'utf-8'
      );
    }
  }

  static completeSetup(): void {
    this.setSetupStep('complete');
  }

  /**
   * Validates if a target directory exists and is strictly EMPTY.
   */
  static validateDirectory(targetPath: string): { isValid: boolean; isEmpty: boolean; error?: string; path: string } {
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

      const files = fs.readdirSync(resolved);
      if (files.length > 0) {
        return {
          isValid: false,
          isEmpty: false,
          error: 'The selected folder is not empty. Please select or create an empty folder to continue.',
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
