import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { AppPaths } from './utils/paths';
import { Logger } from './utils/logger';
import { registerServerIpc } from './ipc/server.ipc';
import { registerNetworkIpc } from './ipc/network.ipc';
import { registerPluginsIpc } from './ipc/plugins.ipc';
import { registerConfigIpc } from './ipc/config.ipc';
import { registerModsIpc } from './ipc/mods.ipc';
import { registerWorldIpc } from './ipc/world.ipc';
import { ServerManagerService } from './services/server-manager.service';
import { PlayitService } from './services/playit.service';
import { UpnpService } from './services/upnp.service';
import { LanBroadcastService } from './services/lan-broadcast.service';
import { handleSquirrelEvent } from './utils/squirrel';

// Prefer IPv4 first across all network lookups to prevent ECONNRESET on networks with broken/unrouted IPv6
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// __filename and __dirname are globally available in CommonJS

const logger = new Logger('Main');

// Set environment variables for electron
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

// Disable GPU hardware acceleration & lock sRGB color profile on Windows:
// Chromium 132's ANGLE D3D11 + DirectComposition + MPO GPU compositor corrupts tiles into
// yellow/pink (magenta) artifacts on NVIDIA/Windows drivers during tab switches and dark-mode repaints.
// On macOS, Metal compositing is unaffected, so keep native acceleration there.
if (process.platform === 'win32') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('force-color-profile', 'srgb');
}

// Disable HTTP disk cache to prevent cache_util_win.cc Access Denied (0x5) errors
app.commandLine.appendSwitch('disable-http-cache');

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  AppPaths.init();

  const getIconPath = () => {
    const ext = process.platform === 'win32' ? 'ico' : 'png';
    const packagedPath = path.join(__dirname, `../dist/craftora.${ext}`);
    const publicPath = path.join(__dirname, `../public/craftora.${ext}`);
    const srcPath = path.join(__dirname, `../src/assets/craftora.${ext}`);
    if (fs.existsSync(packagedPath)) return packagedPath;
    if (fs.existsSync(publicPath)) return publicPath;
    return srcPath;
  };
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    title: 'CraftTogether',
    width: 1280,
    height: 820,
    minWidth: 1050,
    minHeight: 680,
    frame: false, // Frameless window for custom titlebar (avoid combining with titleBarStyle on Windows)
    backgroundColor: '#ffffff',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false // Keep full 60fps and realtime server telemetry even when running in background
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
      let isDevUrl = false;
      if (process.env.VITE_DEV_SERVER_URL) {
        try {
          const devOrigin = new URL(process.env.VITE_DEV_SERVER_URL).origin;
          const targetOrigin = new URL(url).origin;
          isDevUrl = devOrigin === targetOrigin;
        } catch {
          isDevUrl = url.startsWith(process.env.VITE_DEV_SERVER_URL);
        }
      }
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
  registerModsIpc();
  registerConfigIpc(mainWindow);
  registerWorldIpc(mainWindow);

  // Smooth window reveal
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    logger.info('CraftTogether main window displayed');
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Handle Squirrel.Windows install/update/uninstall events immediately
if (!handleSquirrelEvent()) {
  // Ensure single-instance lock
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    // App lifecycle
    app.whenReady().then(createWindow);
  }

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
}

