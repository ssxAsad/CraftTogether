import fs from 'fs';
import path from 'path';
import { JarDownloaderService } from './jar-downloader.service';
import { ConfigParserService } from './config-parser.service';
import { Logger } from '../utils/logger';

const logger = new Logger('GeyserService');

export interface GeyserConfig {
  bedrockPort: number;
  bedrockAddress: string;
  cloneRemotePort?: boolean;
  authType: 'floodgate' | 'online' | 'offline';
  motd1: string;
  motd2: string;
  passthroughMotd: boolean;
  passthroughMaxPlayers: boolean;
}

export class GeyserService {
  private static GEYSER_SPIGOT_URL = 'https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot';
  private static FLOODGATE_SPIGOT_URL = 'https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot';

  /**
   * Checks if GeyserMC is installed in the server plugins directory.
   */
  static isGeyserInstalled(serverDir: string): boolean {
    const pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir)) return false;
    const files = fs.readdirSync(pluginsDir);
    return files.some(f => f.toLowerCase().includes('geyser') && f.endsWith('.jar'));
  }

  /**
   * Checks if Floodgate is installed in the server plugins directory.
   */
  static isFloodgateInstalled(serverDir: string): boolean {
    const pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir)) return false;
    const files = fs.readdirSync(pluginsDir);
    return files.some(f => f.toLowerCase().includes('floodgate') && f.endsWith('.jar'));
  }

  /**
   * 1-Click install of both GeyserMC & Floodgate plugins for seamless Java + Bedrock cross-play.
   */
  static async installGeyserAndFloodgate(
    serverDir: string,
    onProgress?: (plugin: string, percent: number) => void
  ): Promise<void> {
    const pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    const geyserDest = path.join(pluginsDir, 'Geyser-Spigot.jar');
    const floodgateDest = path.join(pluginsDir, 'floodgate-spigot.jar');

    logger.info('Downloading GeyserMC Spigot plugin...');
    await JarDownloaderService.downloadFile(this.GEYSER_SPIGOT_URL, geyserDest, (percent) => {
      if (onProgress) onProgress('GeyserMC', percent);
    });

    logger.info('Downloading Floodgate Spigot plugin...');
    await JarDownloaderService.downloadFile(this.FLOODGATE_SPIGOT_URL, floodgateDest, (percent) => {
      if (onProgress) onProgress('Floodgate', percent);
    });

    // Pre-create/ensure Geyser config directory & default optimized config
    this.ensureGeyserConfig(serverDir, {
      bedrockPort: 19132,
      bedrockAddress: '0.0.0.0',
      cloneRemotePort: false,
      authType: 'floodgate',
      motd1: 'CraftTogether Cross-Play Server',
      motd2: 'Java & Bedrock Supported!',
      passthroughMotd: true,
      passthroughMaxPlayers: true
    });

    logger.info('GeyserMC & Floodgate cross-play setup complete!');
  }

  /**
   * Reads GeyserMC configuration if present.
   */
  static getGeyserConfig(serverDir: string): GeyserConfig {
    const configPath = path.join(serverDir, 'plugins', 'Geyser-Spigot', 'config.yml');
    const defaultConfig: GeyserConfig = {
      bedrockPort: 19132,
      bedrockAddress: '0.0.0.0',
      cloneRemotePort: false,
      authType: 'floodgate',
      motd1: 'CraftTogether Server',
      motd2: 'Cross-Play Active',
      passthroughMotd: true,
      passthroughMaxPlayers: true
    };

    if (!fs.existsSync(configPath)) return defaultConfig;

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const portMatch = content.match(/port:\s*(\d+)/);
      const authMatch = content.match(/auth-type:\s*(\w+)/);
      const motd1Match = content.match(/motd1:\s*["']?([^"'\n\r]+)["']?/);
      const motd2Match = content.match(/motd2:\s*["']?([^"'\n\r]+)["']?/);
      const cloneRemotePort = content.includes('clone-remote-port: true');

      return {
        bedrockPort: portMatch ? parseInt(portMatch[1], 10) : 19132,
        bedrockAddress: '0.0.0.0',
        cloneRemotePort: cloneRemotePort,
        authType: (authMatch ? authMatch[1] : 'floodgate') as 'floodgate' | 'online' | 'offline',
        motd1: motd1Match ? motd1Match[1] : defaultConfig.motd1,
        motd2: motd2Match ? motd2Match[1] : defaultConfig.motd2,
        passthroughMotd: content.includes('passthrough-motd: true'),
        passthroughMaxPlayers: content.includes('passthrough-max-players: true')
      };
    } catch (e) {
      logger.error('Failed to read Geyser config.yml', e);
      return defaultConfig;
    }
  }

  /**
   * Generates or updates GeyserMC configuration to ensure Bedrock port 19132 and Floodgate authentication.
   */
  static ensureGeyserConfig(serverDir: string, config: GeyserConfig): void {
    const geyserFolder = path.join(serverDir, 'plugins', 'Geyser-Spigot');
    if (!fs.existsSync(geyserFolder)) {
      fs.mkdirSync(geyserFolder, { recursive: true });
    }

    const configPath = path.join(geyserFolder, 'config.yml');

    // Read actual Java server port from server.properties if available
    let javaPort = 25565;
    try {
      const props = ConfigParserService.readProperties(serverDir);
      if (props['server-port']) {
        javaPort = Number(props['server-port']) || 25565;
      }
    } catch {}

    const bedrockPort = Number(config.bedrockPort) || 19132;
    const cloneRemotePort = config.cloneRemotePort === true;
    const authType = config.authType || 'floodgate';
    const motd1 = (config.motd1 || 'CraftTogether Bedrock Server').replace(/"/g, '');
    const motd2 = (config.motd2 || 'Java + Bedrock Cross-Play').replace(/"/g, '');
    const passthroughMotd = config.passthroughMotd !== false;
    const passthroughMaxPlayers = config.passthroughMaxPlayers !== false;
    
    // Clean YAML template with high-performance GeyserMC tuning
    const yamlContent = `# GeyserMC Configuration - Managed by CraftTogether
bedrock:
  address: 0.0.0.0
  port: ${bedrockPort}
  clone-remote-port: ${cloneRemotePort ? 'true' : 'false'}
  motd1: "${motd1}"
  motd2: "${motd2}"
  server-name: "CraftTogether"
  enable-proxy-connections: false

remote:
  address: 127.0.0.1
  port: ${javaPort}
  auth-type: ${authType}
  use-proxy-protocol: false

passthrough-motd: ${passthroughMotd ? 'true' : 'false'}
passthrough-protocol-name: true
passthrough-player-counts: true
passthrough-max-players: ${passthroughMaxPlayers ? 'true' : 'false'}
legacy-ping-passthrough: false
ping-passthrough-interval: 10
forward-hostname: true

max-players: 100
debug-mode: false
allow-third-party-capes: false
show-cooldown: title
show-coordinates: true
disable-custom-skins: false

# High-Performance Tuning for Smooth Gameplay & Low RAM
advanced:
  cache-images: 14
  scoreboard-packet-threshold: 20
  add-team-suggestions: false
  bedrock:
    compression-level: 1
    mtu: 1400
  java:
    use-direct-connection: true
    disable-compression: true
`;

    fs.writeFileSync(configPath, yamlContent, 'utf-8');
    logger.info(`Geyser configuration written to: ${configPath}`);
  }

  /**
   * Removes Geyser & Floodgate plugins.
   */
  static removeGeyser(serverDir: string): void {
    const pluginsDir = path.join(serverDir, 'plugins');
    if (!fs.existsSync(pluginsDir)) return;

    const files = fs.readdirSync(pluginsDir);
    for (const file of files) {
      if ((file.toLowerCase().includes('geyser') || file.toLowerCase().includes('floodgate')) && file.endsWith('.jar')) {
        fs.unlinkSync(path.join(pluginsDir, file));
      }
    }
    logger.info('GeyserMC and Floodgate plugins removed');
  }
}
