import path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';

/**
 * Handles Squirrel.Windows install/update/uninstall lifecycle events.
 * Returns true if a Squirrel event was handled (in which case the application should terminate).
 */
export function handleSquirrelEvent(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  const cmd = process.argv[1];
  if (!cmd || !cmd.startsWith('--squirrel-')) {
    return false;
  }

  const target = path.basename(process.execPath);
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');

  const run = (args: string[]) => {
    try {
      const child = spawn(updateExe, args, { detached: true });
      child.on('close', () => {
        app.quit();
      });
      child.on('error', () => {
        app.quit();
      });
    } catch {
      app.quit();
    }
  };

  switch (cmd) {
    case '--squirrel-install':
    case '--squirrel-updated':
      run(['--createShortcut=' + target]);
      return true;

    case '--squirrel-uninstall':
      run(['--removeShortcut=' + target]);
      return true;

    case '--squirrel-obsolete':
      app.quit();
      return true;

    default:
      return false;
  }
}

