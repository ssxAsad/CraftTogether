import { ipcMain, BrowserWindow } from 'electron';
import { UpnpService } from '../services/upnp.service';
import { PlayitService } from '../services/playit.service';
import { LanBroadcastService } from '../services/lan-broadcast.service';
import { NetworkTesterService } from '../services/network-tester.service';

export function registerNetworkIpc(mainWindow?: BrowserWindow): void {
  // Broadcast real-time Cloud Relay status updates to renderer
  if (mainWindow) {
    PlayitService.onStatusChange((status) => {
      try {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cloud-tunnel:status-update', status);
        }
      } catch {}
    });
  }
  // 1. UPnP Direct Router Port Forwarding
  ipcMain.handle('upnp:check-support', async (_, forceRefresh?: boolean) => {
    return await UpnpService.checkSupport(Boolean(forceRefresh));
  });

  ipcMain.handle('upnp:start', async (_, { port = 25565, protocol = 'TCP', description }: { port?: number; protocol?: 'TCP' | 'UDP'; description?: string }) => {
    return await UpnpService.openPort(port, protocol, description);
  });

  ipcMain.handle('upnp:stop', async (_, { port = 25565, protocol = 'TCP' }: { port?: number; protocol?: 'TCP' | 'UDP' } = {}) => {
    return await UpnpService.closePort(port, protocol);
  });

  ipcMain.handle('upnp:get-status', () => {
    return UpnpService.getStatus();
  });

  // 2. Cloud Relay (Playit Zero-Auth Engine)
  ipcMain.handle('cloud-tunnel:start', async (_, { port = 25565 }: { port?: number } = {}) => {
    return await PlayitService.startTunnel(port);
  });

  ipcMain.handle('cloud-tunnel:stop', async () => {
    return await PlayitService.stopTunnel();
  });

  ipcMain.handle('cloud-tunnel:get-status', () => {
    return PlayitService.getStatus();
  });

  ipcMain.handle('cloud-tunnel:ensure-binary', async () => {
    return await PlayitService.ensureBinary();
  });

  // 3. Native LAN Broadcast
  ipcMain.handle('lan:start', (_, { motd, port }) => {
    LanBroadcastService.startBroadcasting(motd, port);
    return true;
  });

  ipcMain.handle('lan:stop', () => {
    LanBroadcastService.stopBroadcasting();
    return true;
  });

  ipcMain.handle('lan:get-status', () => {
    return LanBroadcastService.getIsRunning();
  });

  // 5. Network Diagnostics & IPs
  ipcMain.handle('network:get-diagnostics', async () => {
    return await NetworkTesterService.getDiagnostics();
  });

  ipcMain.handle('network:check-port', async (_, port: number) => {
    return await NetworkTesterService.checkPortListening(port);
  });
}

