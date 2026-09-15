import { ipcMain } from 'electron';
import { ModManagerService } from '../services/mod-manager.service';
import { AppPaths } from '../utils/paths';

export function registerModsIpc(): void {
  ipcMain.handle('mods:get-installed', (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ModManagerService.getInstalledMods(serverDir);
  });

  ipcMain.handle('mods:upload-package', async (_, { serverId, zipFilePath }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return await ModManagerService.uploadModPackage(serverDir, zipFilePath);
  });

  ipcMain.handle('mods:toggle', (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ModManagerService.toggleMod(serverDir, filename);
  });

  ipcMain.handle('mods:delete', (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return ModManagerService.deleteMod(serverDir, filename);
  });
}
