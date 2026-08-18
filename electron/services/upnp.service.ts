import dgram from 'dgram';
import http from 'http';
import os from 'os';
import { URL } from 'url';
import { Logger } from '../utils/logger';

const logger = new Logger('UpnpService');

export interface UpnpStatusResult {
  isSupported: boolean;
  isActive: boolean;
  externalIp: string | null;
  mappedPort: number | null;
  routerName?: string | null;
  error?: string | null;
  unsupportedReason?: string | null;
}

interface IgdEndpoint {
  controlUrl: string;
  serviceType: string;
  baseUrl: string;
  friendlyName?: string;
}

export class UpnpService {
  private static cachedEndpoint: IgdEndpoint | null = null;
  private static supportChecked: boolean = false;
  private static isSupportedCached: boolean = false;
  private static unsupportedReasonCached: string | null = null;

  private static currentStatus: UpnpStatusResult = {
    isSupported: false,
    isActive: false,
    externalIp: null,
    mappedPort: null,
    routerName: null,
    error: null,
    unsupportedReason: null
  };

  /**
   * Discovers local network IPv4 address.
   */
  static getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('127.')) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  /**
   * Discovers UPnP IGD (Internet Gateway Device) via SSDP M-SEARCH broadcast.
   */
  private static discoverIgd(timeoutMs: number = 3500): Promise<string | null> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      let resolved = false;

      const finish = (result: string | null) => {
        if (resolved) return;
        resolved = true;
        try {
          socket.close();
        } catch {}
        resolve(result);
      };

      const timer = setTimeout(() => {
        finish(null);
      }, timeoutMs);

      socket.on('error', (err) => {
        logger.warn('SSDP UDP socket error', err);
        clearTimeout(timer);
        finish(null);
      });

      socket.on('message', (msg) => {
        const text = msg.toString('utf-8');
        if (text.includes('LOCATION:') || text.includes('location:')) {
          const match = text.match(/LOCATION:\s*(http[^\r\n]+)/i);
          if (match && match[1]) {
            clearTimeout(timer);
            finish(match[1].trim());
          }
        }
      });

      socket.bind(0, () => {
        try {
          socket.setBroadcast(true);
          const searchTargets = [
            'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
            'urn:schemas-upnp-org:service:WANIPConnection:1',
            'urn:schemas-upnp-org:service:WANPPPConnection:1',
            'ssdp:all'
          ];

          for (const target of searchTargets) {
            const query = Buffer.from(
              `M-SEARCH * HTTP/1.1\r\n` +
              `HOST: 239.255.255.250:1900\r\n` +
              `MAN: "ssdp:discover"\r\n` +
              `MX: 3\r\n` +
              `ST: ${target}\r\n\r\n`
            );
            socket.send(query, 0, query.length, 1900, '239.255.255.250');
          }
        } catch (e) {
          logger.warn('Failed to send SSDP query', e);
          clearTimeout(timer);
          finish(null);
        }
      });
    });
  }

  /**
   * Fetches the IGD root XML description and extracts WANIPConnection / WANPPPConnection control URL.
   */
  private static fetchXml(locationUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(locationUrl);
        const req = http.get(parsed, { timeout: 3000 }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('IGD XML fetch timed out'));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Resolves IGD Control URL and Service Type from the router descriptor.
   */
  private static async resolveIgdEndpoint(forceRefresh: boolean = false): Promise<IgdEndpoint | null> {
    if (this.cachedEndpoint && !forceRefresh) {
      return this.cachedEndpoint;
    }

    try {
      const location = await this.discoverIgd();
      if (!location) {
        return null;
      }

      const xml = await this.fetchXml(location);
      const parsedLocation = new URL(location);
      const baseUrl = `${parsedLocation.protocol}//${parsedLocation.host}`;

      // Extract Friendly Name (e.g. Archer C6, TP-Link, Netgear)
      let friendlyName = 'Local Router Gateway';
      const nameMatch = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
      if (nameMatch && nameMatch[1]) {
        friendlyName = nameMatch[1].trim();
      }

      // Check for WANIPConnection or WANPPPConnection service
      const services = [
        'urn:schemas-upnp-org:service:WANIPConnection:1',
        'urn:schemas-upnp-org:service:WANIPConnection:2',
        'urn:schemas-upnp-org:service:WANPPPConnection:1',
        'urn:schemas-upnp-org:service:WANPPPConnection:2'
      ];

      for (const serviceType of services) {
        if (xml.includes(serviceType)) {
          // Find service block
          const serviceBlockRegex = new RegExp(`<service>[\\s\\S]*?<serviceType>${serviceType}<\\/serviceType>[\\s\\S]*?<controlURL>([^<]+)<\\/controlURL>[\\s\\S]*?<\\/service>`, 'i');
          const match = xml.match(serviceBlockRegex);
          if (match && match[1]) {
            let controlUrl = match[1].trim();
            if (!controlUrl.startsWith('http')) {
              if (!controlUrl.startsWith('/')) controlUrl = `/${controlUrl}`;
              controlUrl = `${baseUrl}${controlUrl}`;
            }

            this.cachedEndpoint = {
              controlUrl,
              serviceType,
              baseUrl,
              friendlyName
            };
            return this.cachedEndpoint;
          }
        }
      }

      return null;
    } catch (e) {
      logger.warn('Failed to resolve UPnP IGD endpoint', e);
      return null;
    }
  }

  /**
   * Executes a SOAP action against the router's UPnP service.
   */
  private static sendSoapAction(endpoint: IgdEndpoint, action: string, args: Record<string, string>): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const urlObj = new URL(endpoint.controlUrl);
        let argXml = '';
        for (const [k, v] of Object.entries(args)) {
          argXml += `<${k}>${v}</${k}>\n`;
        }

        const body =
          `<?xml version="1.0"?>\n` +
          `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\n` +
          `  <s:Body>\n` +
          `    <u:${action} xmlns:u="${endpoint.serviceType}">\n` +
          `      ${argXml}` +
          `    </u:${action}>\n` +
          `  </s:Body>\n` +
          `</s:Envelope>`;

        const postData = Buffer.from(body, 'utf-8');

        const req = http.request(
          {
            hostname: urlObj.hostname,
            port: urlObj.port ? parseInt(urlObj.port) : 80,
            path: `${urlObj.pathname}${urlObj.search}`,
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml; charset="utf-8"',
              'Content-Length': postData.length,
              'SOAPAction': `"${endpoint.serviceType}#${action}"`,
              'Connection': 'Close'
            },
            timeout: 4000
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve(data);
              } else {
                reject(new Error(`SOAP request failed (${res.statusCode}): ${data}`));
              }
            });
          }
        );

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('SOAP request timed out'));
        });

        req.write(postData);
        req.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Queries router for External Public IP.
   */
  private static async getExternalIpFromRouter(endpoint: IgdEndpoint): Promise<string | null> {
    try {
      const response = await this.sendSoapAction(endpoint, 'GetExternalIPAddress', {});
      const match = response.match(/<NewExternalIPAddress>([^<]+)<\/NewExternalIPAddress>/i);
      if (match && match[1] && match[1].trim() !== '0.0.0.0') {
        return match[1].trim();
      }
    } catch (e) {
      logger.warn('Failed to query router External IP via UPnP', e);
    }
    return null;
  }

  private static probePromise: Promise<UpnpStatusResult> | null = null;

  /**
   * Probes the local network router to verify if UPnP IGD is supported and active.
   */
  static async checkSupport(forceRefresh: boolean = false): Promise<UpnpStatusResult> {
    if (this.supportChecked && !forceRefresh) {
      return { ...this.currentStatus };
    }

    if (this.probePromise && !forceRefresh) {
      return this.probePromise;
    }

    this.probePromise = (async () => {
      try {
        logger.info('Probing local router for UPnP IGD capability...');
        const endpoint = await this.resolveIgdEndpoint(forceRefresh);

        if (!endpoint) {
          this.supportChecked = true;
          this.isSupportedCached = false;
          this.unsupportedReasonCached =
            'UPnP is unavailable or disabled on your current network gateway. Your router or ISP does not allow automatic port mapping.';
          this.currentStatus = {
            ...this.currentStatus,
            isSupported: false,
            unsupportedReason: this.unsupportedReasonCached,
            error: null
          };
          logger.info('UPnP not supported on current gateway.');
          return { ...this.currentStatus };
        }

        const externalIp = await this.getExternalIpFromRouter(endpoint);
        this.supportChecked = true;
        this.isSupportedCached = true;
        this.unsupportedReasonCached = null;

        this.currentStatus = {
          ...this.currentStatus,
          isSupported: true,
          routerName: endpoint.friendlyName || 'Active UPnP Gateway',
          externalIp: externalIp || this.currentStatus.externalIp,
          unsupportedReason: null,
          error: null
        };

        logger.info(`UPnP is supported on router (${endpoint.friendlyName}), ExtIP: ${externalIp}`);
        return { ...this.currentStatus };
      } catch (err: any) {
        this.supportChecked = true;
        this.isSupportedCached = false;
        this.unsupportedReasonCached =
          'UPnP discovery failed on your local network. Please ensure UPnP is enabled on your router.';
        this.currentStatus = {
          ...this.currentStatus,
          isSupported: false,
          unsupportedReason: this.unsupportedReasonCached,
          error: err.message
        };
        return { ...this.currentStatus };
      } finally {
        this.probePromise = null;
      }
    })();

    return this.probePromise;
  }

  /**
   * Opens / forwards server port on the router via UPnP.
   */
  static async openPort(
    port: number = 25565,
    protocol: 'TCP' | 'UDP' = 'TCP',
    description: string = 'DukeCraftora Minecraft Server'
  ): Promise<UpnpStatusResult> {
    try {
      const endpoint = await this.resolveIgdEndpoint();
      if (!endpoint) {
        return {
          isSupported: false,
          isActive: false,
          externalIp: null,
          mappedPort: null,
          error: 'Cannot open port: UPnP is not supported or disabled on your router.',
          unsupportedReason: 'UPnP is disabled on this network router.'
        };
      }

      const localIp = this.getLocalIp();
      logger.info(`Forwarding UPnP ${protocol} port ${port} -> ${localIp}:${port}...`);

      await this.sendSoapAction(endpoint, 'AddPortMapping', {
        NewRemoteHost: '',
        NewExternalPort: port.toString(),
        NewProtocol: protocol,
        NewInternalPort: port.toString(),
        NewInternalClient: localIp,
        NewEnabled: '1',
        NewPortMappingDescription: description,
        NewLeaseDuration: '0'
      });

      const extIp = (await this.getExternalIpFromRouter(endpoint)) || this.currentStatus.externalIp;

      this.currentStatus = {
        isSupported: true,
        isActive: true,
        externalIp: extIp,
        mappedPort: port,
        routerName: endpoint.friendlyName,
        error: null,
        unsupportedReason: null
      };

      logger.info(`UPnP Port ${port} successfully opened! Join address: ${extIp}:${port}`);
      return { ...this.currentStatus };
    } catch (err: any) {
      logger.error('Failed to open UPnP port mapping', err);
      this.currentStatus = {
        ...this.currentStatus,
        isActive: false,
        error: `UPnP Port Forwarding failed: ${err.message || 'Unknown error'}`
      };
      return { ...this.currentStatus };
    }
  }

  /**
   * Closes / releases the UPnP port mapping on the router.
   */
  static async closePort(port: number = 25565, protocol: 'TCP' | 'UDP' = 'TCP'): Promise<UpnpStatusResult> {
    try {
      if (this.cachedEndpoint && this.currentStatus.isActive) {
        logger.info(`Releasing UPnP port mapping ${protocol} ${port}...`);
        await this.sendSoapAction(this.cachedEndpoint, 'DeletePortMapping', {
          NewRemoteHost: '',
          NewExternalPort: port.toString(),
          NewProtocol: protocol
        });
      }
    } catch (e) {
      logger.warn('Failed to delete UPnP port mapping cleanly', e);
    }

    this.currentStatus = {
      ...this.currentStatus,
      isActive: false,
      mappedPort: null,
      error: null
    };

    return { ...this.currentStatus };
  }

  /**
   * Returns current UPnP state.
   */
  static getStatus(): UpnpStatusResult {
    return { ...this.currentStatus };
  }
}
