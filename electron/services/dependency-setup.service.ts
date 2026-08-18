import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { AppPaths } from '../utils/paths';
import { JavaDetectorService } from './java-detector.service';
import { JarDownloaderService } from './jar-downloader.service';
import { PlayitService } from './playit.service';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = new Logger('DependencySetup');

export interface DependencyStatus {
  id: 'java' | 'cloud_relay' | 'papermc' | 'plugins';
  name: string;
  description: string;
  status: 'ready' | 'missing' | 'installing' | 'error';
  progress: number;
  error?: string;
  details?: string;
}

export class DependencySetupService {
  /**
   * Scans and returns the status of all essential dependencies in the workspace.
   */
  static async checkAllDependencies(): Promise<DependencyStatus[]> {
    const results: DependencyStatus[] = [];

    // 1. Check Java 21+
    try {
      const runtimes = await JavaDetectorService.detectJavaRuntimes();
      const hasJava21 = runtimes.some(r => r.majorVersion >= 21);
      results.push({
        id: 'java',
        name: 'Java 21 JRE Runtime',
        description: 'Required engine to run modern Minecraft servers (1.20.5+)',
        status: hasJava21 ? 'ready' : 'missing',
        progress: hasJava21 ? 100 : 0,
        details: hasJava21 ? `Found Java ${runtimes.find(r => r.majorVersion >= 21)?.version}` : 'Not installed on system'
      });
    } catch {
      results.push({
        id: 'java',
        name: 'Java 21 JRE Runtime',
        description: 'Required engine to run modern Minecraft servers (1.20.5+)',
        status: 'missing',
        progress: 0
      });
    }

    // 2. Check PlayIt.gg Tunnel Agent Binary
    try {
      const isInstalled = PlayitService.isBinaryInstalled();
      results.push({
        id: 'cloud_relay',
        name: 'PlayIt.gg Tunnel Daemon',
        description: 'Embedded tunnel client for worldwide multiplayer sharing without port forwarding',
        status: isInstalled ? 'ready' : 'missing',
        progress: isInstalled ? 100 : 0,
        details: isInstalled ? 'Binary Cached & Ready' : 'Ready for download'
      });
    } catch {
      results.push({
        id: 'cloud_relay',
        name: 'PlayIt.gg Tunnel Daemon',
        description: 'Embedded tunnel client for worldwide multiplayer sharing without port forwarding',
        status: 'missing',
        progress: 0,
        details: 'Ready for download'
      });
    }

    // 3. Check PaperMC Engine
    const downloadsDir = AppPaths.getDownloadsDir();
    AppPaths.ensureDir(downloadsDir);
    const existingJars = fs.existsSync(downloadsDir)
      ? fs.readdirSync(downloadsDir).filter(f => f.startsWith('paper') && f.endsWith('.jar'))
      : [];
    const hasPaper = existingJars.length > 0 && fs.statSync(path.join(downloadsDir, existingJars[0])).size > 10 * 1024 * 1024;
    const paperName = existingJars.length > 0 ? existingJars[0].replace('.jar', '') : 'PaperMC Latest Core';

    results.push({
      id: 'papermc',
      name: 'PaperMC Server Core (Latest)',
      description: 'High-performance Minecraft server engine pre-cached in workspace',
      status: hasPaper ? 'ready' : 'missing',
      progress: hasPaper ? 100 : 0,
      details: hasPaper ? `Pre-cached (${paperName})` : 'Not cached'
    });

    // 4. Check Essential Plugins (SkinsRestorer, Geyser, Floodgate)
    const pluginsCacheDir = AppPaths.getPluginsCacheDir();
    AppPaths.ensureDir(pluginsCacheDir);
    const skinsJar = path.join(pluginsCacheDir, 'SkinsRestorer.jar');
    const geyserJar = path.join(pluginsCacheDir, 'Geyser-Spigot.jar');
    const floodgateJar = path.join(pluginsCacheDir, 'Floodgate-Spigot.jar');

    const hasSkins = fs.existsSync(skinsJar) && fs.statSync(skinsJar).size > 500 * 1024;
    const hasGeyser = fs.existsSync(geyserJar) && fs.statSync(geyserJar).size > 5 * 1024 * 1024;
    const hasFloodgate = fs.existsSync(floodgateJar) && fs.statSync(floodgateJar).size > 500 * 1024;
    const pluginsReady = hasSkins && hasGeyser && hasFloodgate;

    results.push({
      id: 'plugins',
      name: 'Essential Plugins (SkinsRestorer & Geyser Cross-Play)',
      description: 'Bedrock iOS/Android/Xbox cross-play & cracked player skin support',
      status: pluginsReady ? 'ready' : 'missing',
      progress: pluginsReady ? 100 : 0,
      details: pluginsReady ? 'SkinsRestorer & GeyserMC cached' : 'Not cached'
    });

    return results;
  }

  /**
   * Installs/pre-caches a specific dependency by ID.
   */
  static async installDependency(
    id: 'java' | 'cloud_relay' | 'papermc' | 'plugins',
    onProgress: (percent: number, message?: string) => void
  ): Promise<boolean> {
    logger.info(`Installing dependency: ${id}`);

    if (id === 'java') {
      return await JavaDetectorService.downloadAndInstallJava21(onProgress);
    }

    if (id === 'cloud_relay') {
      onProgress(10, 'Downloading PlayIt.gg Tunnel Daemon...');
      const downloaded = await PlayitService.ensureBinary(onProgress);
      if (!downloaded) return false;
      onProgress(100, 'PlayIt.gg Tunnel Daemon Cached & Ready!');
      return true;
    }

    if (id === 'papermc') {
      onProgress(5, 'Resolving latest PaperMC build...');
      const downloadsDir = AppPaths.getDownloadsDir();
      AppPaths.ensureDir(downloadsDir);

      let targetVersion = '26.2';
      try {
        const available = await JarDownloaderService.getAvailableVersions('paper');
        if (available.length > 0) targetVersion = available[0];
      } catch (e) {
        logger.warn('Failed to query latest Paper version, defaulting to 26.2', e);
      }

      const targetPath = path.join(downloadsDir, `paper-${targetVersion}.jar`);

      await JarDownloaderService.downloadServerJar('paper', targetVersion, downloadsDir, (prog) => {
        onProgress(prog.percent, `Downloading PaperMC ${targetVersion}... ${prog.percent}%`);
      });

      // Ensure named paper-{targetVersion}.jar
      const downloadedServerJar = path.join(downloadsDir, 'server.jar');
      if (fs.existsSync(downloadedServerJar)) {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        fs.renameSync(downloadedServerJar, targetPath);
      }

      onProgress(100, `PaperMC ${targetVersion} cached successfully!`);
      return true;
    }

    if (id === 'plugins') {
      const pluginsCacheDir = AppPaths.getPluginsCacheDir();
      AppPaths.ensureDir(pluginsCacheDir);

      // 1. SkinsRestorer
      onProgress(10, 'Downloading SkinsRestorer...');
      const skinsUrl = 'https://github.com/SkinsRestorer/SkinsRestorerX/releases/latest/download/SkinsRestorer.jar';
      const skinsDest = path.join(pluginsCacheDir, 'SkinsRestorer.jar');
      await JarDownloaderService.downloadFile(skinsUrl, skinsDest, (p) => {
        onProgress(Math.round(p * 0.3), `Downloading SkinsRestorer... ${p}%`);
      });

      // 2. Geyser-Spigot
      onProgress(35, 'Downloading GeyserMC Bedrock cross-play plugin...');
      const geyserUrl = 'https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot';
      const geyserDest = path.join(pluginsCacheDir, 'Geyser-Spigot.jar');
      await JarDownloaderService.downloadFile(geyserUrl, geyserDest, (p) => {
        onProgress(30 + Math.round(p * 0.4), `Downloading GeyserMC... ${p}%`);
      });

      // 3. Floodgate-Spigot
      onProgress(75, 'Downloading Floodgate auth bypass plugin...');
      const floodgateUrl = 'https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot';
      const floodgateDest = path.join(pluginsCacheDir, 'Floodgate-Spigot.jar');
      await JarDownloaderService.downloadFile(floodgateUrl, floodgateDest, (p) => {
        onProgress(70 + Math.round(p * 0.3), `Downloading Floodgate... ${p}%`);
      });

      onProgress(100, 'All essential plugins cached in workspace!');
      return true;
    }

    return false;
  }
}
