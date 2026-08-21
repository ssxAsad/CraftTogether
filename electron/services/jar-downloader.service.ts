import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { AppPaths } from '../utils/paths';
import { Logger } from '../utils/logger';

const logger = new Logger('JarDownloader');

export type ServerSoftwareType = 'paper' | 'purpur' | 'vanilla' | 'fabric';

export interface VersionInfo {
  version: string;
  type: 'release' | 'snapshot';
  build?: number | string;
}

export interface DownloadProgress {
  software: string;
  version: string;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export class JarDownloaderService {
  /**
   * Helper to check if a version string is >= 1.12.2 and is a clean release.
   */
  private static isSupportedVersion(v: string): boolean {
    if (!v || typeof v !== 'string') return false;
    // Exclude snapshots/pre-releases/release candidates
    if (v.includes('pre') || v.includes('rc') || v.includes('snapshot') || v.includes('w') || v.includes('alpha') || v.includes('beta')) {
      return false;
    }

    const parts = v.split('.').map(p => parseInt(p, 10));
    if (parts.length === 0 || isNaN(parts[0])) return false;

    // Modern Minecraft versions: 26.x, or 1.x where x >= 12 (1.12.2+)
    if (parts[0] >= 2) return true;
    if (parts[0] === 1) {
      if (parts[1] > 12) return true;
      if (parts[1] === 12) {
        return (parts[2] || 0) >= 2; // 1.12.2
      }
    }
    return false;
  }

  /**
   * Semver comparator for Minecraft versions (e.g. 26.2 > 26.1.2 > 1.21.11 > 1.21.4 > 1.12.2).
   */
  static compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(x => parseInt(x, 10) || 0);
    const pb = b.split('.').map(x => parseInt(x, 10) || 0);

    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) {
        return nb - na; // Descending (latest first)
      }
    }
    return 0;
  }

  /**
   * Fetches available Minecraft versions for a selected server software (Latest down to 1.12.2).
   */
  static async getAvailableVersions(software: ServerSoftwareType): Promise<string[]> {
    try {
      if (software === 'paper') {
        const res = await this.fetchJson<{ versions?: Record<string, string[]> }>('https://fill.papermc.io/v3/projects/paper');
        if (res && res.versions) {
          const list = Object.values(res.versions).flat().filter(v => this.isSupportedVersion(v));
          if (list.length > 0) {
            const unique = Array.from(new Set(list));
            return unique.sort(this.compareVersions);
          }
        }
      } else if (software === 'purpur') {
        const res = await this.fetchJson<{ versions?: string[] }>('https://api.purpurmc.org/v2/purpur');
        if (res && res.versions) {
          const list = res.versions.filter(v => this.isSupportedVersion(v));
          if (list.length > 0) {
            const unique = Array.from(new Set(list));
            return unique.sort(this.compareVersions);
          }
        }
      } else if (software === 'vanilla') {
        const manifest = await this.fetchJson<{ versions: Array<{ id: string; type: string }> }>(
          'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
        );
        const list = manifest.versions
          .filter(v => v.type === 'release' && this.isSupportedVersion(v.id))
          .map(v => v.id);
        if (list.length > 0) {
          const unique = Array.from(new Set(list));
          return unique.sort(this.compareVersions);
        }
      } else if (software === 'fabric') {
        const res = await this.fetchJson<Array<{ version: string; stable: boolean }>>('https://meta.fabricmc.net/v2/versions/game');
        const list = res
          .filter(v => v.stable && this.isSupportedVersion(v.version))
          .map(v => v.version);
        if (list.length > 0) {
          const unique = Array.from(new Set(list));
          return unique.sort(this.compareVersions);
        }
      }
    } catch (err) {
      logger.error('Failed to fetch versions for ' + software, err);
    }

    // Comprehensive fallback down to 1.12.2
    return [
      '26.2', '26.1.2', '26.1.1',
      '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.1', '1.21',
      '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.20',
      '1.19.4', '1.19.3', '1.19.2', '1.19',
      '1.18.2', '1.18.1', '1.17.1',
      '1.16.5', '1.15.2', '1.14.4', '1.13.2', '1.12.2'
    ];
  }

  /**
   * Downloads the server jar file for the specified software and version.
   */
  static async downloadServerJar(
    software: ServerSoftwareType,
    version: string,
    targetDirectory: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    AppPaths.ensureDir(targetDirectory);
    const targetJarName = 'server.jar';
    const targetPath = path.join(targetDirectory, targetJarName);

    logger.info(`Resolving download URL for ${software} ${version}...`);
    const downloadUrl = await this.resolveDownloadUrl(software, version);
    logger.info(`Downloading jar from: ${downloadUrl}`);

    await this.downloadFile(downloadUrl, targetPath, (percent, downloadedBytes, totalBytes) => {
      if (onProgress) {
        onProgress({
          software,
          version,
          percent,
          downloadedBytes,
          totalBytes
        });
      }
    });

    logger.info(`Server jar downloaded successfully to: ${targetPath}`);
    return targetPath;
  }

  /**
   * Resolves the direct download URL for the jar file.
   */
  private static async resolveDownloadUrl(software: ServerSoftwareType, version: string): Promise<string> {
    if (software === 'paper') {
      try {
        const versionData = await this.fetchJson<{ builds: number[] }>(
          `https://fill.papermc.io/v3/projects/paper/versions/${version}`
        );
        if (versionData.builds && versionData.builds.length > 0) {
          const latestBuild = versionData.builds[0];
          const buildData = await this.fetchJson<{ downloads: { 'server:default': { url: string } } }>(
            `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/${latestBuild}`
          );
          if (buildData?.downloads?.['server:default']?.url) {
            return buildData.downloads['server:default'].url;
          }
        }
      } catch (v3Err) {
        logger.warn('Paper V3 lookup failed, attempting V2 endpoint', v3Err);
      }

      // Paper V2 fallback
      const v2Data = await this.fetchJson<{ builds: number[] }>(
        `https://api.papermc.io/v2/projects/paper/versions/${version}`
      );
      if (!v2Data.builds || v2Data.builds.length === 0) {
        throw new Error(`No builds found for Paper version ${version}`);
      }
      const latestBuild = v2Data.builds[v2Data.builds.length - 1];
      const buildData = await this.fetchJson<{ downloads: { application: { name: string } } }>(
        `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}`
      );
      return `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}/downloads/${buildData.downloads.application.name}`;
    }

    if (software === 'purpur') {
      const buildsData = await this.fetchJson<{ builds: { latest: string } }>(
        `https://api.purpurmc.org/v2/purpur/${version}`
      );
      return `https://api.purpurmc.org/v2/purpur/${version}/${buildsData.builds.latest}/download`;
    }

    if (software === 'vanilla') {
      const manifest = await this.fetchJson<{ versions: Array<{ id: string; url: string }> }>(
        'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
      );
      const versionEntry = manifest.versions.find(v => v.id === version);
      if (!versionEntry) throw new Error(`Vanilla version ${version} not found`);

      const versionData = await this.fetchJson<{ downloads: { server: { url: string } } }>(versionEntry.url);
      return versionData.downloads.server.url;
    }

    if (software === 'fabric') {
      // Fabric server jar direct installer
      const loaderRes = await this.fetchJson<Array<{ loader: { version: string } }>>(
        `https://meta.fabricmc.net/v2/versions/loader/${version}`
      );
      const loaderVer = loaderRes[0]?.loader?.version || '0.16.9';
      const installerVer = '1.0.1';
      return `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVer}/${installerVer}/server/jar`;
    }

    throw new Error(`Unsupported software: ${software}`);
  }

  /**
   * Generic file downloader with redirect handling and byte stream progress.
   */
  static downloadFile(
    url: string,
    destPath: string,
    onProgress?: (percent: number, downloaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const client = url.startsWith('https') ? https : http;

      const request = client.get(url, { headers: { 'User-Agent': 'Craftora/1.0.0' } }, (res) => {
        // Follow redirects (both relative and absolute)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          try {
            const redirectUrl = new URL(res.headers.location, url).href;
            return this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
          } catch (urlErr) {
            return reject(new Error(`Invalid redirect URL: ${res.headers.location}`));
          }
        }

        if (res.statusCode !== 200) {
          file.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return reject(new Error(`Server returned HTTP ${res.statusCode}: ${res.statusMessage}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          if (onProgress) {
            onProgress(percent, downloadedBytes, totalBytes);
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          file.close(() => resolve());
        });
      });

      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    });
  }

  /**
   * Helper to fetch JSON from HTTPS API endpoint.
   */
  static fetchJson<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Craftora/1.0.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          try {
            const redirectUrl = new URL(res.headers.location, url).href;
            return this.fetchJson<T>(redirectUrl).then(resolve).catch(reject);
          } catch (urlErr) {
            return reject(new Error(`Invalid redirect URL: ${res.headers.location}`));
          }
        }
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON response from ${url}: ${e}`));
          }
        });
      }).on('error', reject);
    });
  }
}
