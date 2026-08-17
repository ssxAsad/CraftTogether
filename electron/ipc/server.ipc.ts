import { ipcMain, BrowserWindow } from 'electron';
import { ServerManagerService, ServerInstanceConfig } from '../services/server-manager.service';
import { JavaDetectorService } from '../services/java-detector.service';
import { JarDownloaderService, ServerSoftwareType } from '../services/jar-downloader.service';
import { AppPaths } from '../utils/paths';

export function registerServerIpc(mainWindow: BrowserWindow): void {
  // Wire up server events to renderer
  ServerManagerService.setCallbacks({
    onLog: (logs) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:log', logs);
      }
    },
    onStatus: (status) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:status-changed', status);
      }
    },
    onMetrics: (metrics) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:metrics-updated', metrics);
      }
    },
    onPlayers: (players) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:players-updated', players);
      }
    }
  });

  // Handle server actions
  ipcMain.handle('server:start', async (_, config: ServerInstanceConfig) => {
    return await ServerManagerService.startServer(config);
  });

  ipcMain.handle('server:stop', async () => {
    return await ServerManagerService.stopServer();
  });

  ipcMain.handle('server:kill', async () => {
    ServerManagerService.killServer();
    return true;
  });

  ipcMain.handle('server:send-command', async (_, cmd: string) => {
    return ServerManagerService.sendCommand(cmd);
  });

  ipcMain.handle('server:get-status', () => {
    return ServerManagerService.getStatus();
  });

  ipcMain.handle('server:get-metrics', () => {
    return ServerManagerService.getMetrics();
  });

  ipcMain.handle('server:get-players', () => {
    return ServerManagerService.getPlayers();
  });

  // Java discovery & installation
  ipcMain.handle('java:detect-all', async () => {
    return await JavaDetectorService.detectJavaRuntimes();
  });

  ipcMain.handle('java:install-21', async () => {
    return await JavaDetectorService.downloadAndInstallJava21((percent) => {
      if (!mainWindow.isDestroyed()) {
        // We can reuse the jar download progress event or create a new one, but let's just send a generic progress
        mainWindow.webContents.send('java:install-progress', percent);
      }
    });
  });

  // Jar downloads & version catalog
  ipcMain.handle('jars:get-versions', async (_, software: ServerSoftwareType) => {
    return await JarDownloaderService.getAvailableVersions(software);
  });

  ipcMain.handle('jars:download-jar', async (_, { software, version, serverId }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return await JarDownloaderService.downloadServerJar(software, version, serverDir, (progress) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('jars:download-progress', progress);
      }
    });
  });
}
