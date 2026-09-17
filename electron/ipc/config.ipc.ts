import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import fs from 'fs';
import path from 'path';
import { ConfigParserService, ServerProperties } from '../services/config-parser.service';
import { AppPaths } from '../utils/paths';

export function registerConfigIpc(mainWindow: BrowserWindow): void {
  // First Launch & Workspace setup IPC
  ipcMain.handle('app:get-setup-status', () => {
    return {
      isSetupComplete: AppPaths.isSetupComplete(),
      setupStep: AppPaths.getSetupStep(),
      storageDirectory: AppPaths.getBaseDir()
    };
  });

  ipcMain.handle('app:validate-directory', (_, targetPath: string) => {
    return AppPaths.validateDirectory(targetPath);
  });

  ipcMain.handle('app:set-storage-directory', (_, targetPath: string) => {
    AppPaths.setStorageDir(targetPath);
    return true;
  });

  ipcMain.handle('app:set-setup-step', (_, step: 'directory' | 'dependencies' | 'playit' | 'complete') => {
    AppPaths.setSetupStep(step);
    return true;
  });

  ipcMain.handle('app:complete-setup', () => {
    AppPaths.completeSetup();
    return true;
  });

  ipcMain.handle('dialog:browse-directory', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Directory for Server Files',
        properties: ['openDirectory'],
        buttonLabel: 'Select Folder'
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return null;
      }

      const selectedPath = result.filePaths[0];
      const validation = AppPaths.validateDirectory(selectedPath);
      return {
        path: selectedPath,
        validation
      };
    } catch (e) {
      console.error('Error in dialog:browse-directory', e);
      return null;
    }
  });

  // Setup Prerequisites & Dependency Pre-caching IPC
  ipcMain.handle('setup:check-dependencies', async () => {
    const { DependencySetupService } = await import('../services/dependency-setup.service');
    return await DependencySetupService.checkAllDependencies();
  });

  ipcMain.handle('setup:install-dependency', async (_, id: 'java' | 'cloud_relay' | 'papermc' | 'plugins') => {
    const { DependencySetupService } = await import('../services/dependency-setup.service');
    return await DependencySetupService.installDependency(id, (percent, message) => {
      mainWindow.webContents.send('setup:dependency-progress', { id, percent, message });
    });
  });

  // Server properties
  ipcMain.handle('config:read-properties', (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ConfigParserService.readProperties(serverDir);
  });

  ipcMain.handle('config:write-properties', (_, { serverId, properties }: { serverId: string; properties: Partial<ServerProperties> }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    ConfigParserService.writeProperties(serverDir, properties);
    return true;
  });

  ipcMain.handle('config:set-cracked', (_, { serverId, isCracked }: { serverId: string; isCracked: boolean }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    ConfigParserService.setCrackedMode(serverDir, isCracked);
    return true;
  });

  // Window frameless controls
  ipcMain.on('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow.close();
  });

  // App Paths & Instances helper
  ipcMain.handle('paths:get-servers-dir', () => {
    return AppPaths.getServersDir();
  });

  ipcMain.handle('servers:list', async () => {
    const sDir = AppPaths.getServersDir();
    try {
      await fs.promises.access(sDir);
    } catch {
      return [];
    }
    
    const entries = await fs.promises.readdir(sDir, { withFileTypes: true });
    
    const serverPromises = entries.filter(e => e.isDirectory()).map(async (e) => {
      const serverPath = path.join(sDir, e.name);
      const props = await ConfigParserService.readPropertiesAsync(serverPath);
      let meta: any = {};
      const metaPath = path.join(serverPath, 'craftora.json');
      
      try {
        const metaContent = await fs.promises.readFile(metaPath, 'utf8');
        meta = JSON.parse(metaContent);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.warn('Failed to parse server metadata for', e.name, err);
        }
      }

      return {
        id: e.name,
        name: meta.name || e.name,
        path: serverPath,
        serverSoftware: meta.serverSoftware || 'paper',
        version: meta.version || '1.21.4',
        allocatedRamGb: meta.allocatedRamGb || 4,
        javaPath: meta.javaPath || 'java',
        useAikarFlags: meta.useAikarFlags !== false,
        port: props['server-port'] || meta.port || 25565,
        isCracked: props['online-mode'] === false || meta.isCracked === true,
        networkMode: meta.networkMode === 'lan_only' ? 'lan_only' : meta.networkMode === 'upnp' ? 'upnp' : 'cloud_relay',
        motd: props['motd'] || meta.motd || 'Craftora Server',
        keepInventory: meta.keepInventory !== undefined ? meta.keepInventory : true,
        showCoordinates: meta.showCoordinates !== undefined ? meta.showCoordinates : true,
        onePlayerSleep: meta.onePlayerSleep !== undefined ? meta.onePlayerSleep : true,
        disableMobGriefing: meta.disableMobGriefing !== undefined ? meta.disableMobGriefing : false,
        disableFireSpread: meta.disableFireSpread !== undefined ? meta.disableFireSpread : false
      };
    });

    return await Promise.all(serverPromises);
  });

  ipcMain.handle('servers:save-config', (_, { serverId, config }: { serverId: string; config: any }) => {
    try {
      const serverDir = AppPaths.getServerPath(serverId);
      AppPaths.ensureDir(serverDir);
      const metaPath = path.join(serverDir, 'craftora.json');
      let existing: any = {};
      if (fs.existsSync(metaPath)) {
        try {
          existing = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (e) {}
      }
      const updated = { ...existing, ...config };
      fs.writeFileSync(metaPath, JSON.stringify(updated, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Failed to save server config', err);
      return false;
    }
  });

  ipcMain.handle('servers:delete', async (_, serverId: string) => {
    try {
      const serverDir = path.join(AppPaths.getServersDir(), serverId);
      if (fs.existsSync(serverDir)) {
        fs.rmSync(serverDir, { recursive: true, force: true });
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to delete server directory', serverId, err);
      throw err;
    }
  });

  // Open URL directly in default Windows browser (Chrome/Edge/Firefox/Brave)
  ipcMain.handle('system:open-external', async (_, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });
}
