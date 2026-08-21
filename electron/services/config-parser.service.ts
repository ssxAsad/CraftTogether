import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

const logger = new Logger('ConfigParser');

export interface ServerProperties {
  'server-port'?: number;
  'online-mode'?: boolean;
  'motd'?: string;
  'max-players'?: number;
  'difficulty'?: 'peaceful' | 'easy' | 'normal' | 'hard';
  'gamemode'?: 'survival' | 'creative' | 'adventure' | 'spectator';
  'pvp'?: boolean;
  'hardcore'?: boolean;
  'enable-command-block'?: boolean;
  'spawn-protection'?: number;
  'view-distance'?: number;
  'simulation-distance'?: number;
  'white-list'?: boolean;
  'enable-rcon'?: boolean;
  'rcon.port'?: number;
  'rcon.password'?: string;
  'allow-flight'?: boolean;
  'level-name'?: string;
  'level-seed'?: string;
  [key: string]: any;
}

export class ConfigParserService {
  /**
   * Accepts the Minecraft EULA by writing eula=true into eula.txt.
   */
  static acceptEula(serverDir: string): void {
    const eulaPath = path.join(serverDir, 'eula.txt');
    const content = `# Minecraft EULA accepted via Craftora\neula=true\n`;
    fs.writeFileSync(eulaPath, content, 'utf-8');
    logger.info(`EULA accepted for server at: ${serverDir}`);
  }

  /**
   * Reads and parses server.properties.
   */
  static readProperties(serverDir: string): ServerProperties {
    const propPath = path.join(serverDir, 'server.properties');
    const defaultProperties: ServerProperties = {
      'server-port': 25565,
      'online-mode': true,
      'motd': 'A Craftora Minecraft Server',
      'max-players': 20,
      'difficulty': 'normal',
      'gamemode': 'survival',
      'pvp': true,
      'hardcore': false,
      'enable-command-block': true,
      'spawn-protection': 16,
      'view-distance': 10,
      'simulation-distance': 10,
      'white-list': false,
      'allow-flight': true,
      'level-name': 'world'
    };

    if (!fs.existsSync(propPath)) {
      return defaultProperties;
    }

    try {
      const content = fs.readFileSync(propPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      const props: Record<string, any> = { ...defaultProperties };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();

          if (val === 'true') props[key] = true;
          else if (val === 'false') props[key] = false;
          else if (/^\d+$/.test(val)) props[key] = parseInt(val, 10);
          else props[key] = val;
        }
      }

      return props as ServerProperties;
    } catch (e) {
      logger.error('Failed to read server.properties', e);
      return defaultProperties;
    }
  }

  /**
   * Writes updated server.properties while preserving unedited values.
   */
  static writeProperties(serverDir: string, updatedProps: Partial<ServerProperties>): void {
    const propPath = path.join(serverDir, 'server.properties');
    const current = this.readProperties(serverDir);
    const merged = { ...current, ...updatedProps };

    const lines: string[] = [
      '# Minecraft server properties - Managed by Craftora',
      `# Last updated: ${new Date().toISOString()}`
    ];

    for (const [key, value] of Object.entries(merged)) {
      lines.push(`${key}=${value}`);
    }

    fs.writeFileSync(propPath, lines.join('\n') + '\n', 'utf-8');
    logger.info(`server.properties updated for server at: ${serverDir}`);
  }

  /**
   * Sets cracked (offline) mode on or off.
   */
  static setCrackedMode(serverDir: string, isCracked: boolean): void {
    this.writeProperties(serverDir, {
      'online-mode': !isCracked
    });
    logger.info(`Cracked mode set to: ${isCracked} (online-mode=${!isCracked})`);
  }
}
