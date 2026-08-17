import { ipcMain } from 'electron';
import { NgrokService } from '../services/ngrok.service';
import { LanBroadcastService } from '../services/lan-broadcast.service';
import { NetworkTesterService } from '../services/network-tester.service';

export function registerNetworkIpc(): void {
  // ngrok Free TCP Tunnel
  ipcMain.handle('ngrok:start', async (_, { port, authToken }) => {
    return await NgrokService.startTunnel(port, authToken);
  });

  ipcMain.handle('ngrok:stop', async () => {
    return await NgrokService.stopTunnel();
  });

  ipcMain.handle('ngrok:get-status', () => {
    return NgrokService.getStatus();
  });

  ipcMain.handle('ngrok:save-token', (_, token: string) => {
    NgrokService.saveToken(token);
    return true;
  });

  ipcMain.handle('ngrok:get-token', () => {
    return NgrokService.getSavedToken();
  });

  // Native LAN Broadcast
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

  // Network Diagnostics & IPs
  ipcMain.handle('network:get-diagnostics', async () => {
    return await NetworkTesterService.getDiagnostics();
  });

  ipcMain.handle('network:check-port', async (_, port: number) => {
    return await NetworkTesterService.checkPortListening(port);
  });
}
