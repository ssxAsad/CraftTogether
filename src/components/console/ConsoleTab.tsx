import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { useServer } from '../../context/ServerContext';

export const ConsoleTab: React.FC = () => {
  const { logs, sendCommand, clearLogs, status } = useServer();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const [inputCommand, setInputCommand] = useState('');
  const [copied, setCopied] = useState(false);

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#06090e',
        foreground: '#e2e8f0',
        cursor: '#10b981',
        cursorAccent: '#06090e',
        selectionBackground: 'rgba(16, 185, 129, 0.3)',
        black: '#0f172a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: false,
      convertEol: true,
      scrollback: 1500
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    term.writeln('\x1b[1;32m=== Craftora Interactive Minecraft Server Console ===\x1b[0m');
    term.writeln('\x1b[90mReady for server output and commands...\x1b[0m\r\n');

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  // Write new logs into xterm
  const lastWrittenIdx = useRef(0);
  useEffect(() => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;

    const linesToWrite: string[] = [];
    for (let i = lastWrittenIdx.current; i < logs.length; i++) {
      const log = logs[i];
      if (log.type === 'stderr') {
        linesToWrite.push(`\x1b[31m${log.line}\x1b[0m`);
      } else if (log.type === 'system') {
        linesToWrite.push(`\x1b[1;36m${log.line}\x1b[0m`);
      } else if (log.line.includes('WARN')) {
        linesToWrite.push(`\x1b[33m${log.line}\x1b[0m`);
      } else if (log.line.includes('ERROR')) {
        linesToWrite.push(`\x1b[31m${log.line}\x1b[0m`);
      } else {
        linesToWrite.push(log.line);
      }
    }
    if (linesToWrite.length > 0) {
      term.writeln(linesToWrite.join('\r\n'));
    }
    lastWrittenIdx.current = logs.length;
  }, [logs]);

  const handleClear = () => {
    clearLogs();
    lastWrittenIdx.current = 0;
    if (xtermInstance.current) {
      xtermInstance.current.clear();
      xtermInstance.current.writeln('\x1b[90mConsole cleared.\x1b[0m\r\n');
    }
  };

  const handleCopyAll = () => {
    const text = logs.map(l => l.line).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;
    sendCommand(inputCommand.trim());
    setInputCommand('');
  };

  const quickCommands = [
    { label: 'list', cmd: 'list' },
    { label: 'tps', cmd: 'tps' },
    { label: 'gamemode creative', cmd: 'gamemode creative' },
    { label: 'gamemode survival', cmd: 'gamemode survival' },
    { label: 'weather clear', cmd: 'weather clear' },
    { label: 'time set day', cmd: 'time set day' },
    { label: 'save-all', cmd: 'save-all' }
  ];

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-2.5rem)] space-y-4 max-w-7xl mx-auto">
      {/* Header & Tooling */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-bg text-content-primary flex items-center justify-center">
            <PlaceholderIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-content-primary">Live Server Terminal</h1>
            <p className="text-xs text-content-secondary">Interactive standard input/output stream</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 px-3 py-2 leading-none rounded-lg text-xs font-semibold bg-neutral-bg hover:bg-surface-hover text-content-primary transition"
          >
            {copied ? <PlaceholderIcon className="w-3.5 h-3.5 text-content-primary" /> : <PlaceholderIcon className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'PlaceholderIcon Logs'}</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-2 leading-none rounded-lg text-xs font-semibold bg-neutral-bg hover:bg-surface-hover text-content-primary hover:text-danger-fg transition"
          >
            <PlaceholderIcon className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Quick Command Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-[11px] font-bold uppercase text-content-secondary flex items-center gap-1">
          <PlaceholderIcon className="w-3 h-3 text-content-primary" /> Shortcuts:
        </span>
        {quickCommands.map((q) => (
          <button
            key={q.cmd}
            onClick={() => sendCommand(q.cmd)}
            disabled={status !== 'ONLINE'}
            className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-surface-card hover:bg-surface-hover hover:text-content-primary text-content-secondary border border-border-default hover:border-border-default transition disabled:opacity-40"
          >
            /{q.label}
          </button>
        ))}
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 min-h-0 bg-surface-base rounded-xl border border-border-default p-2 overflow-hidden shadow-2xl">
        <div ref={terminalRef} className="w-full h-full" />
      </div>

      {/* Interactive Command Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-content-primary font-bold text-sm">
            &gt;
          </span>
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            disabled={status !== 'ONLINE'}
            placeholder={
              status === 'ONLINE'
                ? "Type a Minecraft server command (e.g. op Player, weather clear, stop)..."
                : "Server is not running. Start server to execute commands."
            }
            className="w-full pl-8 pr-4 py-2.5 bg-surface-elevated border border-border-default rounded-lg text-xs font-mono text-content-primary placeholder:text-content-muted focus:outline-none focus:border-border-default transition disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={status !== 'ONLINE' || !inputCommand.trim()}
          className="px-5 py-2.5 bg-success hover:bg-success/80 disabled:opacity-40 text-surface-base font-bold text-xs rounded-lg flex items-center gap-2 transition"
        >
          <PlaceholderIcon className="w-3.5 h-3.5" />
          <span>PlaceholderIcon</span>
        </button>
      </form>
    </div>
  );
};
