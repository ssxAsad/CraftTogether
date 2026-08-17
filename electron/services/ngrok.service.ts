import fs from 'fs';
import path from 'path';
import ngrok from '@ngrok/ngrok';
import { AppPaths } from '../utils/paths';
import { Logger } from '../utils/logger';

const logger = new Logger('NgrokService');

export interface NgrokStatus {
  isActive: boolean;
  publicUrl: string | null;
  serverAddress: string | null; // e.g. "4.tcp.ngrok.io:12345"
  port: number;
  authToken: string;
  error?: string | null;
}

export class NgrokService {
  private static activeListener: any = null;
  private static currentStatus: NgrokStatus = {
    isActive: false,
    publicUrl: null,
    serverAddress: null,
    port: 25565,
    authToken: '',
    error: null
  };

  /**
   * Loads saved ngrok auth token from app config.
   */
  static getSavedToken(): string {
    try {
      const configPath = path.join(AppPaths.getBaseDir(), 'ngrok.json');
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return data.authToken || '';
      }
    } catch (e) {
      logger.error('Failed to load ngrok token', e);
    }
    return '';
  }

  /**
   * Saves ngrok auth token to local app config.
   */
  static saveToken(token: string): void {
    try {
      const configPath = path.join(AppPaths.getBaseDir(), 'ngrok.json');
      fs.writeFileSync(configPath, JSON.stringify({ authToken: token }, null, 2), 'utf-8');
      this.currentStatus.authToken = token;
    } catch (e) {
      logger.error('Failed to save ngrok token', e);
    }
  }

  /**
   * Starts free ngrok TCP tunnel for Minecraft server port (25565).
   */
  static async startTunnel(port: number = 25565, authToken?: string): Promise<NgrokStatus> {
    const token = authToken || this.getSavedToken();
    if (!token) {
      this.currentStatus = {
        isActive: false,
        publicUrl: null,
        serverAddress: null,
        port,
        authToken: '',
        error: 'Please provide a free ngrok Authtoken from your ngrok.com dashboard.'
      };
      return this.currentStatus;
    }

    if (this.activeListener) {
      await this.stopTunnel();
    }

    try {
      this.saveToken(token);
      logger.info(`Starting ngrok TCP tunnel on port ${port}...`);

      const session = await new ngrok.SessionBuilder()
        .authtoken(token)
        .connect();

      const listener = await session
        .tcpEndpoint()
        .listen();

      const forwardTarget = `localhost:${port}`;
      listener.forward(forwardTarget);

      this.activeListener = listener;
      const rawUrl = listener.url() || ''; // e.g. "tcp://4.tcp.ngrok.io:12345"
      const cleanAddress = rawUrl ? rawUrl.replace('tcp://', '') : `localhost:${port}`;

      this.currentStatus = {
        isActive: true,
        publicUrl: rawUrl,
        serverAddress: cleanAddress,
        port,
        authToken: token,
        error: null
      };

      logger.info(`ngrok TCP tunnel active: ${cleanAddress}`);
      return this.currentStatus;
    } catch (err: any) {
      logger.error('Failed to start ngrok tunnel', err);
      this.currentStatus = {
        isActive: false,
        publicUrl: null,
        serverAddress: null,
        port,
        authToken: token,
        error: err.message || 'Failed to establish ngrok tunnel.'
      };
      return this.currentStatus;
    }
  }

  /**
   * Stops the active ngrok tunnel.
   */
  static async stopTunnel(): Promise<NgrokStatus> {
    if (this.activeListener) {
      try {
        await this.activeListener.close();
        logger.info('ngrok tunnel closed');
      } catch (e) {
        logger.warn('Error while closing ngrok listener', e);
      }
      this.activeListener = null;
    }

    this.currentStatus.isActive = false;
    this.currentStatus.publicUrl = null;
    this.currentStatus.serverAddress = null;
    this.currentStatus.error = null;

    return this.currentStatus;
  }

  /**
   * Returns the current status of the ngrok tunnel.
   */
  static getStatus(): NgrokStatus {
    if (!this.currentStatus.authToken) {
      this.currentStatus.authToken = this.getSavedToken();
    }
    return { ...this.currentStatus };
  }
}
