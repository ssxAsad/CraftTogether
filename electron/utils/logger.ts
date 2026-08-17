export class Logger {
  private scope: string;

  constructor(scope: string) {
    this.scope = scope;
  }

  info(...args: unknown[]): void {
    console.log(`\x1b[36m[${this.scope}]\x1b[0m`, ...args);
  }

  warn(...args: unknown[]): void {
    console.warn(`\x1b[33m[${this.scope}] WARN:\x1b[0m`, ...args);
  }

  error(...args: unknown[]): void {
    console.error(`\x1b[31m[${this.scope}] ERROR:\x1b[0m`, ...args);
  }

  debug(...args: unknown[]): void {
    console.debug(`\x1b[90m[${this.scope}] DEBUG:\x1b[0m`, ...args);
  }
}
