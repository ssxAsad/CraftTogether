import { ipcMain } from 'electron';
import { GeyserService, GeyserConfig } from '../services/geyser.service';
import { PluginManagerService } from '../services/plugin-manager.service';
import { AppPaths } from '../utils/paths';

export function registerPluginsIpc(): void {
  // GeyserMC Cross-Play
  ipcMain.handle('geyser:is-installed', (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return GeyserService.isGeyserInstalled(serverDir);
  });

  ipcMain.handle('geyser:install', async (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    await GeyserService.installGeyserAndFloodgate(serverDir);
    return true;
  });

  ipcMain.handle('geyser:remove', (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    GeyserService.removeGeyser(serverDir);
    return true;
  });

  ipcMain.handle('geyser:get-config', (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return GeyserService.getGeyserConfig(serverDir);
  });

  ipcMain.handle('geyser:save-config', (_, { serverId, config }: { serverId: string; config: GeyserConfig }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    GeyserService.ensureGeyserConfig(serverDir, config);
    return true;
  });

  // General Plugins & Popular Catalog
  ipcMain.handle('plugins:get-catalog', () => {
    return PluginManagerService.getPopularCatalog();
  });

  ipcMain.handle('plugins:get-installed', (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return PluginManagerService.getInstalledPlugins(serverDir);
  });

  ipcMain.handle('plugins:install', async (_, { serverId, pluginId }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return await PluginManagerService.installPlugin(serverDir, pluginId);
  });

  ipcMain.handle('plugins:toggle', (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return PluginManagerService.togglePlugin(serverDir, filename);
  });

  ipcMain.handle('plugins:delete', (_, { serverId, filename }) => {
    const serverDir = AppPaths.getServerPath(serverId);
    return PluginManagerService.deletePlugin(serverDir, filename);
  });

  ipcMain.handle('plugins:ensure-skins-restorer', async (_, serverId: string) => {
    const serverDir = AppPaths.getServerPath(serverId);
    await PluginManagerService.ensureSkinsRestorer(serverDir);
    return true;
  });
}
