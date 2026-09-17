import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { Logger } from '../utils/logger';
import { ServerManagerService } from './server-manager.service';
import { ConfigParserService } from './config-parser.service';

const logger = new Logger('WorldManager');

export interface WorldInfo {
  exists: boolean;
  levelName: string;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  playerCount: number;
  regionCount: number;
  hasNether: boolean;
  hasEnd: boolean;
  lastModified?: number;
}

export interface WorldInspectionResult {
  valid: boolean;
  levelName?: string;
  playerCount: number;
  regionCount: number;
  hasNether: boolean;
  hasEnd: boolean;
  isZip: boolean;
  error?: string;
}

export interface ImportWorldResult {
  success: boolean;
  levelName: string;
  playerCount: number;
  regionCount: number;
  backupCreated?: string;
}

export class WorldManagerService {
  /**
   * Helper to format bytes into readable KB/MB/GB string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return `${mb.toFixed(1)} MB`;
    }
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
  }

  /**
   * Calculates the directory size recursively
   */
  private static getDirectorySize(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dirPath, entry.name);
        try {
          if (entry.isDirectory()) {
            total += this.getDirectorySize(full);
          } else if (entry.isFile()) {
            total += fs.statSync(full).size;
          }
        } catch {
          // Skip inaccessible file/folder
        }
      }
    } catch (e) {
      logger.warn(`Could not read dir size for ${dirPath}`, e);
    }
    return total;
  }

  /**
   * Recursively copies a directory
   */
  private static copyDirSync(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.name === 'session.lock') {
        // Skip session.lock to avoid Windows file locks
        continue;
      }
      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch (err) {
          logger.warn(`Failed to copy file ${srcPath}: ${err}`);
        }
      }
    }
  }

  /**
   * Gets details and statistics about the server's current world
   */
  static getWorldInfo(serverDir: string): WorldInfo {
    const props = ConfigParserService.readProperties(serverDir);
    const levelName = props['level-name'] || 'world';
    const worldDir = path.join(serverDir, levelName);
    const netherDir = path.join(serverDir, `${levelName}_nether`);
    const endDir = path.join(serverDir, `${levelName}_the_end`);

    if (!fs.existsSync(worldDir)) {
      return {
        exists: false,
        levelName,
        totalSizeBytes: 0,
        totalSizeFormatted: '0 MB',
        playerCount: 0,
        regionCount: 0,
        hasNether: false,
        hasEnd: false
      };
    }

    let size = this.getDirectorySize(worldDir);
    if (fs.existsSync(netherDir)) size += this.getDirectorySize(netherDir);
    if (fs.existsSync(endDir)) size += this.getDirectorySize(endDir);

    // Count player inventories in playerdata/
    let playerCount = 0;
    const playerdataDir = path.join(worldDir, 'playerdata');
    if (fs.existsSync(playerdataDir)) {
      try {
        const files = fs.readdirSync(playerdataDir);
        playerCount = files.filter(f => f.endsWith('.dat')).length;
      } catch {}
    }

    // Count region chunk files
    let regionCount = 0;
    const regionDir = path.join(worldDir, 'region');
    if (fs.existsSync(regionDir)) {
      try {
        const files = fs.readdirSync(regionDir);
        regionCount = files.filter(f => f.endsWith('.mca')).length;
      } catch {}
    }

    // Check Nether and End presence
    const hasNether = fs.existsSync(netherDir) || fs.existsSync(path.join(worldDir, 'DIM-1'));
    const hasEnd = fs.existsSync(endDir) || fs.existsSync(path.join(worldDir, 'DIM1'));

    let lastModified = 0;
    try {
      lastModified = fs.statSync(worldDir).mtimeMs;
    } catch {}

    return {
      exists: true,
      levelName,
      totalSizeBytes: size,
      totalSizeFormatted: this.formatBytes(size),
      playerCount,
      regionCount,
      hasNether,
      hasEnd,
      lastModified
    };
  }

  /**
   * Inspects a potential world source (.zip or folder) before importing
   */
  static inspectWorldSource(sourcePath: string): WorldInspectionResult {
    if (!fs.existsSync(sourcePath)) {
      return { valid: false, playerCount: 0, regionCount: 0, hasNether: false, hasEnd: false, isZip: false, error: 'Path does not exist.' };
    }

    const stat = fs.statSync(sourcePath);
    const isZip = stat.isFile() && sourcePath.toLowerCase().endsWith('.zip');

    if (isZip) {
      try {
        const zip = new AdmZip(sourcePath);
        const entries = zip.getEntries();

        // Look for level.dat entry
        const levelDatEntry = entries.find(e => e.entryName.toLowerCase().endsWith('level.dat'));
        let rootPrefix = '';
        if (levelDatEntry) {
          rootPrefix = levelDatEntry.entryName.slice(0, levelDatEntry.entryName.toLowerCase().indexOf('level.dat'));
        }

        const normalizedPrefix = rootPrefix.toLowerCase();
        let playerCount = 0;
        let regionCount = 0;
        let hasNether = false;
        let hasEnd = false;

        for (const entry of entries) {
          const name = entry.entryName.toLowerCase();
          if (name.includes('playerdata/') && name.endsWith('.dat')) {
            playerCount++;
          }
          if (name.includes('region/') && name.endsWith('.mca')) {
            regionCount++;
          }
          if (name.includes('dim-1') || name.includes('world_nether')) {
            hasNether = true;
          }
          if (name.includes('dim1') || name.includes('world_the_end')) {
            hasEnd = true;
          }
        }

        if (!levelDatEntry && regionCount === 0) {
          return {
            valid: false,
            playerCount: 0,
            regionCount: 0,
            hasNether: false,
            hasEnd: false,
            isZip: true,
            error: 'No Minecraft world data found (missing level.dat or region directory).'
          };
        }

        const levelName = rootPrefix.replace(/\/$/, '').split('/').pop() || path.basename(sourcePath, '.zip');

        return {
          valid: true,
          levelName,
          playerCount,
          regionCount,
          hasNether,
          hasEnd,
          isZip: true
        };
      } catch (e: any) {
        return {
          valid: false,
          playerCount: 0,
          regionCount: 0,
          hasNether: false,
          hasEnd: false,
          isZip: true,
          error: `Failed to inspect zip: ${e.message}`
        };
      }
    } else if (stat.isDirectory()) {
      // Look for level.dat inside directory or immediate subfolder
      let worldDir = sourcePath;
      if (!fs.existsSync(path.join(worldDir, 'level.dat'))) {
        // Check subdirectories
        const subdirs = fs.readdirSync(sourcePath, { withFileTypes: true }).filter(d => d.isDirectory());
        const candidate = subdirs.find(d => fs.existsSync(path.join(sourcePath, d.name, 'level.dat')));
        if (candidate) {
          worldDir = path.join(sourcePath, candidate.name);
        }
      }

      const hasLevelDat = fs.existsSync(path.join(worldDir, 'level.dat'));
      const regionDir = path.join(worldDir, 'region');
      const hasRegion = fs.existsSync(regionDir);

      if (!hasLevelDat && !hasRegion) {
        return {
          valid: false,
          playerCount: 0,
          regionCount: 0,
          hasNether: false,
          hasEnd: false,
          isZip: false,
          error: 'Not a valid Minecraft world directory (level.dat and region folder not found).'
        };
      }

      let playerCount = 0;
      const playerdataDir = path.join(worldDir, 'playerdata');
      if (fs.existsSync(playerdataDir)) {
        playerCount = fs.readdirSync(playerdataDir).filter(f => f.endsWith('.dat')).length;
      }

      let regionCount = 0;
      if (hasRegion) {
        regionCount = fs.readdirSync(regionDir).filter(f => f.endsWith('.mca')).length;
      }

      const hasNether = fs.existsSync(path.join(worldDir, 'DIM-1')) || fs.existsSync(path.join(sourcePath, 'world_nether'));
      const hasEnd = fs.existsSync(path.join(worldDir, 'DIM1')) || fs.existsSync(path.join(sourcePath, 'world_the_end'));

      return {
        valid: true,
        levelName: path.basename(worldDir),
        playerCount,
        regionCount,
        hasNether,
        hasEnd,
        isZip: false
      };
    }

    return { valid: false, playerCount: 0, regionCount: 0, hasNether: false, hasEnd: false, isZip: false, error: 'Invalid file or directory selected.' };
  }

  /**
   * Imports a downloaded world or folder into the server.
   * Restores terrain, player inventories, settings, Nether and End dimensions.
   */
  static async importWorld(
    serverDir: string,
    sourcePath: string,
    options: { backupCurrent?: boolean } = { backupCurrent: true }
  ): Promise<ImportWorldResult> {
    // 1. Safety verification: Ensure server is stopped
    const status = ServerManagerService.getStatus();
    if (status !== 'STOPPED') {
      throw new Error('Server must be stopped before importing a new world to prevent file corruption.');
    }

    const props = ConfigParserService.readProperties(serverDir);
    const levelName = props['level-name'] || 'world';
    const targetWorldDir = path.join(serverDir, levelName);
    const targetNetherDir = path.join(serverDir, `${levelName}_nether`);
    const targetEndDir = path.join(serverDir, `${levelName}_the_end`);

    let backupCreated: string | undefined;

    // 2. Backup existing world if requested
    if (options.backupCurrent !== false && fs.existsSync(targetWorldDir)) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDirName = `${levelName}_backup_${timestamp}`;
        const backupPath = path.join(serverDir, backupDirName);
        logger.info(`Creating backup of existing world to ${backupPath}`);
        this.copyDirSync(targetWorldDir, backupPath);

        // Also back up Nether and End if present
        if (fs.existsSync(targetNetherDir)) {
          this.copyDirSync(targetNetherDir, path.join(serverDir, `${backupDirName}_nether`));
        }
        if (fs.existsSync(targetEndDir)) {
          this.copyDirSync(targetEndDir, path.join(serverDir, `${backupDirName}_the_end`));
        }
        backupCreated = backupDirName;
      } catch (err) {
        logger.warn(`Failed to create world backup: ${err}`);
      }
    }

    const stat = fs.statSync(sourcePath);
    const isZip = stat.isFile() && sourcePath.toLowerCase().endsWith('.zip');

    // 3. Clear existing world directories to prevent stale region mixups and leftover dimension state
    for (const dir of [targetWorldDir, targetNetherDir, targetEndDir]) {
      if (fs.existsSync(dir)) {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (e) {
          logger.warn(`Could not completely clean ${dir}, overwriting in-place`, e);
        }
      }
    }
    fs.mkdirSync(targetWorldDir, { recursive: true });

    let playerCount = 0;
    let regionCount = 0;

    if (isZip) {
      logger.info(`Importing world from zip: ${sourcePath}`);
      const zip = new AdmZip(sourcePath);
      const entries = zip.getEntries();

      // Find root prefix containing level.dat
      const levelDatEntry = entries.find(e => e.entryName.toLowerCase().endsWith('level.dat'));
      let rootPrefix = '';
      if (levelDatEntry) {
        rootPrefix = levelDatEntry.entryName.slice(0, levelDatEntry.entryName.toLowerCase().indexOf('level.dat'));
      }

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName.replace(/\\/g, '/');

        // Check if entry belongs inside the detected world root
        if (rootPrefix && !entryName.startsWith(rootPrefix)) {
          // If zip has sibling world_nether or world_the_end, extract to respective directories
          if (entryName.toLowerCase().includes('nether')) {
            const rel = entryName.split(/nether\//i)[1];
            if (rel) {
              const dest = path.join(targetNetherDir, rel);
              fs.mkdirSync(path.dirname(dest), { recursive: true });
              fs.writeFileSync(dest, entry.getData());
            }
          } else if (entryName.toLowerCase().includes('end')) {
            const rel = entryName.split(/end\//i)[1];
            if (rel) {
              const dest = path.join(targetEndDir, rel);
              fs.mkdirSync(path.dirname(dest), { recursive: true });
              fs.writeFileSync(dest, entry.getData());
            }
          }
          continue;
        }

        const relativePath = rootPrefix ? entryName.slice(rootPrefix.length) : entryName;
        if (!relativePath || relativePath === 'session.lock') continue;

        // Destination in main world directory
        const destPath = path.join(targetWorldDir, relativePath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, entry.getData());

        // Sibling world_nether or world_the_end extraction only if explicitly present in zip
        if (relativePath.toLowerCase().includes('playerdata/') && relativePath.endsWith('.dat')) {
          playerCount++;
        }
        if (relativePath.toLowerCase().includes('region/') && relativePath.endsWith('.mca')) {
          regionCount++;
        }
      }
    } else if (stat.isDirectory()) {
      logger.info(`Importing world from folder: ${sourcePath}`);
      // Find world root (has level.dat)
      let worldSrc = sourcePath;
      if (!fs.existsSync(path.join(worldSrc, 'level.dat'))) {
        const subdirs = fs.readdirSync(sourcePath, { withFileTypes: true }).filter(d => d.isDirectory());
        const candidate = subdirs.find(d => fs.existsSync(path.join(sourcePath, d.name, 'level.dat')));
        if (candidate) {
          worldSrc = path.join(sourcePath, candidate.name);
        }
      }

      this.copyDirSync(worldSrc, targetWorldDir);

      // Sibling nether/end folders from source directory if explicitly present
      const srcNether = path.join(sourcePath, `${path.basename(worldSrc)}_nether`);
      if (fs.existsSync(srcNether)) {
        this.copyDirSync(srcNether, targetNetherDir);
      }
      const srcEnd = path.join(sourcePath, `${path.basename(worldSrc)}_the_end`);
      if (fs.existsSync(srcEnd)) {
        this.copyDirSync(srcEnd, targetEndDir);
      }

      // Count stats
      const pDir = path.join(targetWorldDir, 'playerdata');
      if (fs.existsSync(pDir)) {
        playerCount = fs.readdirSync(pDir).filter(f => f.endsWith('.dat')).length;
      }
      const rDir = path.join(targetWorldDir, 'region');
      if (fs.existsSync(rDir)) {
        regionCount = fs.readdirSync(rDir).filter(f => f.endsWith('.mca')).length;
      }
    }

    logger.info(`Successfully imported world '${levelName}': ${playerCount} player inventories, ${regionCount} regions`);
    return {
      success: true,
      levelName,
      playerCount,
      regionCount,
      backupCreated
    };
  }

  /**
   * Exports the entire server world (including Nether, End, playerdata, and gamerules) into a .zip archive
   */
  static exportWorld(serverDir: string, targetZipPath: string): { success: boolean; targetZipPath: string; sizeBytes: number } {
    const props = ConfigParserService.readProperties(serverDir);
    const levelName = props['level-name'] || 'world';
    const worldDir = path.join(serverDir, levelName);
    const netherDir = path.join(serverDir, `${levelName}_nether`);
    const endDir = path.join(serverDir, `${levelName}_the_end`);

    if (!fs.existsSync(worldDir)) {
      throw new Error('World folder does not exist yet. Please start the server once to generate a world.');
    }

    logger.info(`Exporting world '${levelName}' to ${targetZipPath}`);
    const zip = new AdmZip();

    // Add main world folder
    zip.addLocalFolder(worldDir, levelName);

    // Add Paper/Purpur Nether and End if present
    if (fs.existsSync(netherDir)) {
      zip.addLocalFolder(netherDir, `${levelName}_nether`);
    }
    if (fs.existsSync(endDir)) {
      zip.addLocalFolder(endDir, `${levelName}_the_end`);
    }

    zip.writeZip(targetZipPath);
    const sizeBytes = fs.statSync(targetZipPath).size;

    logger.info(`World successfully exported to ${targetZipPath} (${sizeBytes} bytes)`);
    return {
      success: true,
      targetZipPath,
      sizeBytes
    };
  }
}
