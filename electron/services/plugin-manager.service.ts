import fs from 'fs';
import path from 'path';
import https from 'https';
import { JarDownloaderService } from './jar-downloader.service';
import { AppPaths } from '../utils/paths';
import { Logger } from '../utils/logger';

const logger = new Logger('PluginManager');

export interface PluginInfo {
  name: string;
  filename: string;
  size: number;
  enabled: boolean;
  isCustom: boolean;
  version?: string;
  description?: string;
  icon?: string;
}

export interface PopularPlugin {
  id: string;
  name: string;
  description: string;
  category: string;
  downloadUrl: string;
  icon: string;
  recommendedForCracked?: boolean;
}

export class PluginManagerService {
  // Curated popular and essential plugins
  private static POPULAR_PLUGINS: PopularPlugin[] = [
    {
      id: 'skinsrestorer',
      name: 'SkinsRestorer',
      description: 'Restores player skins for cracked (offline-mode) servers & allows custom /skin commands.',
      category: 'Cosmetic / Cracked',
      downloadUrl: 'https://github.com/SkinsRestorer/SkinsRestorerX/releases/latest/download/SkinsRestorer.jar',
      icon: 'UserCheck',
      recommendedForCracked: true
    },
    {
      id: 'geyser',
      name: 'Geyser-Spigot',
      description: 'Enables Bedrock (mobile, console, Windows) players to join Java servers seamlessly.',
      category: 'Cross-Play',
      downloadUrl: 'https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot',
      icon: 'Smartphone'
    },
    {
      id: 'viaversion',
      name: 'ViaVersion',
      description: 'Allows newer Minecraft client versions to connect to older server versions.',
      category: 'Compatibility',
      downloadUrl: 'https://github.com/ViaVersion/ViaVersion/releases/latest/download/ViaVersion.jar',
      icon: 'Layers'
    },
    {
      id: 'viabackwards',
      name: 'ViaBackwards',
      description: 'Allows older Minecraft client versions to connect to newer server versions.',
      category: 'Compatibility',
      downloadUrl: 'https://github.com/ViaVersion/ViaBackwards/releases/latest/download/ViaBackwards.jar',
      icon: 'History'
    },
    {
      id: 'essentialsx',
      name: 'EssentialsX',
      description: 'Provides over 100 essential commands, economy, spawn, teleports, and kits.',
      category: 'Core Gameplay',
      downloadUrl: 'https://github.com/EssentialsX/Essentials/releases/latest/download/EssentialsX.jar',
      icon: 'Wrench'
    },
    {
      id: 'chunky',
      name: 'Chunky',
      description: 'Pre-generates world chunks in advance to eliminate chunk-loading lag spikes during gameplay.',
      category: 'Performance',
      downloadUrl: 'https://hangarcdn.papermc.io/plugins/pop4959/Chunky/versions/1.4.28/PAPER/Chunky-1.4.28.jar',
      icon: 'Zap'
    },
    {
      id: 'coreprotect',
      name: 'CoreProtect',
      description: 'Fast, efficient data logging and anti-grief rollback tool.',
      category: 'Security',
      downloadUrl: 'https://mediafilez.forgecdn.net/files/5465/321/CoreProtect-22.4.jar',
      icon: 'Lock'
    },
    {
      id: 'onlysleep',
      name: 'OnlySleep',
      description: 'Modern 1-player sleep plugin with bossbars, percentages, and custom messages.',
      category: 'Core Gameplay',
      downloadUrl: 'https://github.com/onlysleep', // Will be resolved dynamically
      icon: 'Moon'
    }
  ];

  static getPopularCatalog(): PopularPlugin[] {
    return this.POPULAR_PLUGINS;
  }

  /**
   * Lists all plugins installed in the server's plugins directory.
   */
  static getInstalledPlugins(serverDir: string): PluginInfo[] {
    const pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(pluginsDir);
      const list: PluginInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.jar') || file.endsWith('.jar.disabled')) {
          const fullPath = path.join(pluginsDir, file);
          const stats = fs.statSync(fullPath);
          const isEnabled = file.endsWith('.jar');
          const cleanName = file.replace(/\.jar(\.disabled)?$/, '');

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
      logger.error('Failed to list plugins', e);
      return [];
    }
  }

  /**
   * Dynamically resolves the latest direct jar download URL from Modrinth CDN with fallback.
   */
  static async resolvePluginUrl(pluginId: string): Promise<string> {
    const popular = this.POPULAR_PLUGINS.find(p => p.id === pluginId);
    if (!popular) throw new Error(`Plugin ${pluginId} not found`);

    const modrinthSlugs: Record<string, string> = {
      viaversion: 'viaversion',
      viabackwards: 'viabackwards',
      essentialsx: 'essentialsx',
      chunky: 'chunky',
      skinsrestorer: 'skinsrestorer',
      coreprotect: 'coreprotect',
      onlysleep: 'onlysleep'
    };

    if (modrinthSlugs[pluginId]) {
      try {
        const slug = modrinthSlugs[pluginId];
        const versions = await JarDownloaderService.fetchJson<Array<{ files: Array<{ url: string; primary?: boolean; filename: string }> }>>(
          `https://api.modrinth.com/v2/project/${slug}/version`
        );
        if (versions && versions.length > 0) {
          for (const ver of versions) {
            if (ver.files && ver.files.length > 0) {
              const jarFile = ver.files.find(f => f.filename.endsWith('.jar') && !f.filename.includes('sources'));
              if (jarFile?.url) {
                logger.info(`Resolved latest ${popular.name} from Modrinth CDN: ${jarFile.filename}`);
                return jarFile.url;
              }
            }
          }
        }
      } catch (modrinthErr) {
        logger.warn(`Modrinth API lookup for ${pluginId} failed, falling back to static URL`, modrinthErr);
      }
    }

    return popular.downloadUrl;
  }

  /**
   * Installs a popular plugin directly from curated catalog or direct URL.
   */
  static async installPlugin(
    serverDir: string,
    pluginId: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const popular = this.POPULAR_PLUGINS.find(p => p.id === pluginId);
    if (!popular) {
      throw new Error(`Plugin ${pluginId} not found in catalog.`);
    }

    const pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    const destFile = path.join(pluginsDir, `${popular.name}.jar`);

    // 1. Check workspace pre-cache first!
    try {
      const cacheDir = AppPaths.getPluginsCacheDir();
      const cachedCandidates = [
        path.join(cacheDir, `${popular.name}.jar`),
        path.join(cacheDir, `${popular.id}.jar`),
        path.join(cacheDir, 'SkinsRestorer.jar'),
        path.join(cacheDir, 'Geyser-Spigot.jar'),
        path.join(cacheDir, 'Floodgate-Spigot.jar')
      ];

      for (const candidate of cachedCandidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).size > 1000) {
          const candidateBase = path.basename(candidate).toLowerCase();
          const targetBase = popular.name.toLowerCase();
          if (candidateBase.includes(targetBase) || targetBase.includes(candidateBase.replace('.jar', ''))) {
            fs.copyFileSync(candidate, destFile);
            logger.info(`Installed plugin ${popular.name} from local workspace cache.`);
            if (onProgress) onProgress(100);
            return destFile;
          }
        }
      }
    } catch (e) {
      logger.warn('Failed to check plugin cache', e);
    }

    // 2. Resolve download URL (dynamically with fallbacks)
    let downloadUrl = popular.downloadUrl;
    try {
      downloadUrl = await this.resolvePluginUrl(pluginId);
    } catch {
      downloadUrl = popular.downloadUrl;
    }

    logger.info(`Installing plugin ${popular.name} from ${downloadUrl} to ${destFile}...`);
    try {
      await JarDownloaderService.downloadFile(downloadUrl, destFile, onProgress);
      logger.info(`Plugin ${popular.name} installed successfully!`);
      return destFile;
    } catch (err: any) {
      // If dynamic URL failed, retry once with popular.downloadUrl
      if (downloadUrl !== popular.downloadUrl) {
        logger.warn(`Retrying ${popular.name} with static fallback URL: ${popular.downloadUrl}`);
        await JarDownloaderService.downloadFile(popular.downloadUrl, destFile, onProgress);
        return destFile;
      }
      logger.error(`Failed to download plugin ${popular.name}`, err);
      throw err;
    }
  }

  /**
   * Installs a plugin directly from Spiget API using its resource ID.
   */
  static async installSpigetPlugin(
    serverDir: string,
    spigetId: string,
    pluginName: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    // Clean up filename
    const safeName = pluginName.replace(/[^a-zA-Z0-9_\-\ ]/g, '').trim().replace(/\ /g, '_');
    const destFile = path.join(pluginsDir, `${safeName}.jar`);

    const downloadUrl = `https://api.spiget.org/v2/resources/${spigetId}/download`;

    logger.info(`Installing Spiget plugin ${pluginName} (ID: ${spigetId}) from ${downloadUrl} to ${destFile}...`);
    try {
      await JarDownloaderService.downloadFile(downloadUrl, destFile, onProgress);
      logger.info(`Spiget Plugin ${pluginName} installed successfully!`);
      return destFile;
    } catch (err: any) {
      logger.error(`Failed to download Spiget plugin ${pluginName}`, err);
      throw err;
    }
  }

  /**
   * Automatically ensures SkinsRestorer is installed if cracked mode is activated.
   */
  static async ensureSkinsRestorer(serverDir: string): Promise<void> {
    const plugins = this.getInstalledPlugins(serverDir);
    const hasSkins = plugins.some(p => p.name.toLowerCase().includes('skinsrestorer'));
    if (!hasSkins) {
      logger.info('Auto-installing SkinsRestorer for cracked server support...');
      try {
        await this.installPlugin(serverDir, 'skinsrestorer');
      } catch (e) {
        logger.warn('Could not auto-download SkinsRestorer', e);
      }
    }
  }

  /**
   * Toggles a plugin enabled/disabled by renaming the jar extension.
   */
  static togglePlugin(serverDir: string, filename: string): boolean {
    const pluginsDir = path.join(serverDir, 'plugins');
    const oldPath = path.join(pluginsDir, filename);
    if (!fs.existsSync(oldPath)) return false;

    let newPath = '';
    if (filename.endsWith('.disabled')) {
      newPath = path.join(pluginsDir, filename.replace('.disabled', ''));
    } else {
      newPath = path.join(pluginsDir, `${filename}.disabled`);
    }

    fs.renameSync(oldPath, newPath);
    return true;
  }

  /**
   * Deletes a plugin jar file.
   */
  static deletePlugin(serverDir: string, filename: string): boolean {
    const pluginsDir = path.join(serverDir, 'plugins');
    const target = path.join(pluginsDir, filename);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      return true;
    }
    return false;
  }
}
