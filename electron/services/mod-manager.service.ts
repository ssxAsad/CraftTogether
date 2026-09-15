import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { Logger } from '../utils/logger';

const logger = new Logger('ModManager');

export interface ModInfo {
  name: string;
  filename: string;
  size: number;
  enabled: boolean;
}

export class ModManagerService {
  /**
   * Lists all mods installed in the server's mods directory.
   */
  static getInstalledMods(serverDir: string): ModInfo[] {
    const modsDir = path.join(serverDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(modsDir);
      const list: ModInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
          const fullPath = path.join(modsDir, file);
          const stats = fs.statSync(fullPath);
          const isEnabled = file.endsWith('.jar');
          const cleanName = file.replace(/\.jar(\.disabled)?$/, '');

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
      logger.error('Failed to list mods', e);
      return [];
    }
  }

  /**
   * Toggles a mod enabled/disabled by renaming the jar extension.
   */
  static toggleMod(serverDir: string, filename: string): boolean {
    const modsDir = path.join(serverDir, 'mods');
    const oldPath = path.join(modsDir, filename);
    if (!fs.existsSync(oldPath)) return false;

    let newPath = '';
    if (filename.endsWith('.disabled')) {
      newPath = path.join(modsDir, filename.replace('.disabled', ''));
    } else {
      newPath = path.join(modsDir, `${filename}.disabled`);
    }

    fs.renameSync(oldPath, newPath);
    return true;
  }

  /**
   * Deletes a mod jar file.
   */
  static deleteMod(serverDir: string, filename: string): boolean {
    const modsDir = path.join(serverDir, 'mods');
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
  static async uploadModPackage(serverDir: string, zipFilePath: string): Promise<number> {
    const modsDir = path.join(serverDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    try {
      logger.info(`Extracting mod package ${zipFilePath} to ${modsDir}`);
      const zip = new AdmZip(zipFilePath);
      const zipEntries = zip.getEntries();
      
      let jarCount = 0;
      
      for (const entry of zipEntries) {
        if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.jar')) {
          const content = entry.getData();
          // To prevent creating subdirectories (if mod zip has jars in subfolders), just take the filename
          const fileName = path.basename(entry.entryName);
          const destPath = path.join(modsDir, fileName);
          
          fs.writeFileSync(destPath, content);
          jarCount++;
        }
      }
      
      logger.info(`Extracted ${jarCount} mods from ${zipFilePath}`);
      return jarCount;
    } catch (e) {
      logger.error('Failed to extract mod package', e);
      throw e;
    }
  }
}
