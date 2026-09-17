import { ipcMain, BrowserWindow, dialog } from 'electron';
import { WorldManagerService } from '../services/world-manager.service';
import { AppPaths } from '../utils/paths';

export function registerWorldIpc(mainWindow: BrowserWindow): void {
  // Get active world information and stats
  ipcMain.handle('world:get-info', (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return WorldManagerService.getWorldInfo(serverDir);
  });

  // Inspect a file or directory before importing
  ipcMain.handle('world:inspect-source', (_, sourcePath: string) => {
    return WorldManagerService.inspectWorldSource(sourcePath);
  });

  // Native Open Dialog to browse for a .zip file or a world folder
  ipcMain.handle('world:browse-source', async (_, mode: 'file' | 'folder' = 'file') => {
    try {
      if (mode === 'folder') {
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Select Minecraft World Folder',
          properties: ['openDirectory'],
          buttonLabel: 'Select World Folder'
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return null;
        }
        const sourcePath = result.filePaths[0];
        const inspection = WorldManagerService.inspectWorldSource(sourcePath);
        return { sourcePath, inspection };
      } else {
        const result = await dialog.showOpenDialog(mainWindow, {
          title: 'Select Minecraft World Archive (.zip)',
          properties: ['openFile'],
          filters: [
            { name: 'Minecraft World Zip Archive', extensions: ['zip'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          buttonLabel: 'Select World Archive'
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return null;
        }
        const sourcePath = result.filePaths[0];
        const inspection = WorldManagerService.inspectWorldSource(sourcePath);
        return { sourcePath, inspection };
      }
    } catch (e) {
      console.error('Error in world:browse-source', e);
      return null;
    }
  });

  // Native Save Dialog to browse for an export zip file target path
  ipcMain.handle('world:browse-export-target', async (_, defaultFilename: string) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Minecraft World Backup',
        defaultPath: defaultFilename || 'minecraft_world_backup.zip',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
        buttonLabel: 'Export World'
      });
      if (result.canceled || !result.filePath) {
        return null;
      }
      return result.filePath;
    } catch (e) {
      console.error('Error in world:browse-export-target', e);
      return null;
    }
  });

  // Import world archive or folder
  ipcMain.handle(
    'world:import',
    async (
      _,
      {
        serverId,
        sourcePath,
        backupCurrent
      }: { serverId: string; sourcePath: string; backupCurrent?: boolean }
    ) => {
      const serverDir = AppPaths.getServerPath(serverId);
      return await WorldManagerService.importWorld(serverDir, sourcePath, {
        backupCurrent: backupCurrent !== false
      });
    }
  );

  // Export current world to a zip file
  ipcMain.handle(
    'world:export',
    async (_, { serverId, targetZipPath }: { serverId: string; targetZipPath: string }) => {
      const serverDir = AppPaths.getServerPath(serverId);
      return WorldManagerService.exportWorld(serverDir, targetZipPath);
    }
  );
}
