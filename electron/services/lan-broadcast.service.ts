import dgram from 'dgram';
import { Logger } from '../utils/logger';

const logger = new Logger('LanBroadcast');

export class LanBroadcastService {
  private static socket: dgram.Socket | null = null;
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static isRunning: boolean = false;

  private static MULTICAST_ADDRESS = '224.0.2.60';
  private static MULTICAST_PORT = 4445;

  /**
   * Starts broadcasting Minecraft LAN discovery packets.
   */
  static startBroadcasting(motd: string = 'DukeCraftora LAN Server', port: number = 25565): void {
    if (this.isRunning) return;

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.bind(() => {
        if (!this.socket) return;
        this.socket.setBroadcast(true);
        this.socket.setMulticastTTL(4);

        const packetMessage = `[MOTD]${motd}[/MOTD][AD]${port}[/AD]`;
        const buffer = Buffer.from(packetMessage, 'utf-8');

        this.isRunning = true;
        logger.info(`LAN discovery broadcaster started on ${this.MULTICAST_ADDRESS}:${this.MULTICAST_PORT}`);

        this.intervalTimer = setInterval(() => {
          if (!this.socket || !this.isRunning) return;
          this.socket.send(buffer, 0, buffer.length, this.MULTICAST_PORT, this.MULTICAST_ADDRESS, (err) => {
            if (err) {
              logger.debug('Error sending LAN packet', err);
            }
          });
        }, 1500);
      });

      this.socket.on('error', (err) => {
        logger.warn('LAN Broadcast socket error', err);
      });
    } catch (e) {
      logger.error('Failed to start LAN broadcaster', e);
    }
  }

  /**
   * Stops LAN broadcasting.
   */
  static stopBroadcasting(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {
        // ignore
      }
      this.socket = null;
    }
    this.isRunning = false;
    logger.info('LAN discovery broadcaster stopped');
  }

  static getIsRunning(): boolean {
    return this.isRunning;
  }
}
