import os from 'os';
import https from 'https';
import net from 'net';
import { Logger } from '../utils/logger';

const logger = new Logger('NetworkTester');

export interface NetworkDiagnostic {
  localIp: string;
  publicIp: string | null;
  gatewayIp: string | null;
  isOnline: boolean;
}

export class NetworkTesterService {
  /**
   * Retrieves local network IPv4 address.
   */
  static getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name];
      if (!netInterface) continue;
      for (const iface of netInterface) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Resolves public external IP.
   */
  static async getPublicIp(): Promise<string | null> {
    const endpoints = [
      'https://api.ipify.org?format=json',
      'https://api4.my-ip.io/v2/ip.json'
    ];

    for (const url of endpoints) {
      try {
        const ip = await new Promise<string>((resolve, reject) => {
          https.get(url, { timeout: 3500 }, (res) => {
            if (res.statusCode !== 200) return reject();
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed.ip || parsed.data || null);
              } catch {
                reject();
              }
            });
          }).on('error', reject);
        });
        if (ip) return ip;
      } catch {
        // Try next
      }
    }

    return null;
  }

  /**
   * Tests whether a TCP port is open and listening locally.
   */
  static async checkPortListening(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1500);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        resolve(false);
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Complete network diagnostics summary.
   */
  static async getDiagnostics(): Promise<NetworkDiagnostic> {
    const localIp = this.getLocalIp();
    const publicIp = await this.getPublicIp();

    return {
      localIp,
      publicIp,
      gatewayIp: null,
      isOnline: publicIp !== null
    };
  }
}
