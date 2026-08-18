import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { AppPaths } from './utils/paths';
import { Logger } from './utils/logger';
import { registerServerIpc } from './ipc/server.ipc';
import { registerNetworkIpc } from './ipc/network.ipc';
import { registerPluginsIpc } from './ipc/plugins.ipc';
import { registerConfigIpc } from './ipc/config.ipc';
import { ServerManagerService } from './services/server-manager.service';
import { PlayitService } from './services/playit.service';
import { UpnpService } from './services/upnp.service';
import { LanBroadcastService } from './services/lan-broadcast.service';

// __filename and __dirname are globally available in CommonJS

const logger = new Logger('Main');

// Set environment variables for electron
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

// Optimize GPU hardware acceleration & background throttling to minimize CPU
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  AppPaths.init();

  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../src/assets/DC.ico')
    : path.join(__dirname, '../src/assets/DC.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1050,
    minHeight: 680,
    frame: false, // Frameless for modern custom titlebar & Obsidian aesthetic
    titleBarStyle: 'hidden',
    backgroundColor: '#090d16',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: true
    }
  });

  // Ensure any external link or window.open opens directly in default Windows browser (Edge/Chrome/Firefox/Brave)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const isDevUrl = process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
      if (!isDevUrl) {
        event.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  // Register all IPC module handlers
  registerServerIpc(mainWindow);
  registerNetworkIpc(mainWindow);
  registerPluginsIpc();
  registerConfigIpc(mainWindow);

  // Smooth window reveal
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info('DukeCraftora main window displayed');
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  // Graceful cleanup on quit
  logger.info('Shutting down services and network tunnels...');
  await ServerManagerService.stopServer();
  await PlayitService.stopTunnel();
  await UpnpService.closePort();
  LanBroadcastService.stopBroadcasting();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
