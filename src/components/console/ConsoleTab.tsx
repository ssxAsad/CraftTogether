import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Send } from 'lucide-react';
import { useServerState, useServerActions } from '../../context/ServerContext';

export const ConsoleTab: React.FC = () => {
  const { logs, status } = useServerState();
  const { sendCommand } = useServerActions();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);
  const [inputCommand, setInputCommand] = useState('');

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;
    terminalRef.current.innerHTML = '';

    const term = new XTerm({
      theme: {
        background: '#06090e',
        foreground: '#18181b',
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

    if (logs.length === 0 && status !== 'ONLINE' && status !== 'STARTING') {
      term.writeln('\x1b[1;32mWaiting for server startup...\x1b[0m');
    }

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermInstance.current = null;
      fitAddonInstance.current = null;
    };
  }, []);

  // Write new logs into xterm
  const lastWrittenIdx = useRef(0);
  useEffect(() => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;

    if (logs.length > 0 && lastWrittenIdx.current === 0) {
      term.reset();
    }

    const linesToWrite: string[] = [];
    for (let i = lastWrittenIdx.current; i < logs.length; i++) {
      const log = logs[i];
      if (log.type === 'stderr') {
        linesToWrite.push(`\x1b[31m${log.line}\x1b[0m`);
      } else if (log.type === 'system') {
        linesToWrite.push(`\x1b[1;32m${log.line}\x1b[0m`);
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

  // Sync offline status when logs are reset or cleared
  useEffect(() => {
    if (!xtermInstance.current) return;
    const term = xtermInstance.current;
    if (logs.length === 0 && lastWrittenIdx.current > 0) {
      lastWrittenIdx.current = 0;
      term.reset();
      if (status !== 'ONLINE' && status !== 'STARTING') {
        term.writeln('\x1b[1;32mWaiting for server startup...\x1b[0m');
      }
    }
  }, [logs.length, status]);

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

  const isOnline = status === 'ONLINE';

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-2.5rem)] space-y-4 max-w-7xl mx-auto">
      {/* Header & Tooling */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-bg text-content-primary flex items-center justify-center">
            <TerminalIcon className="w-4 h-4" />
          </div>
          <h1 className="text-lg font-bold text-content-primary">Terminal</h1>
        </div>
      </div>

      {/* Quick Command Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
            isOnline ? 'text-content-secondary' : 'text-content-muted'
          }`}
        >
          Shortcuts:
        </span>
        {quickCommands.map((q) => (
          <button
            key={q.cmd}
            onClick={() => sendCommand(q.cmd)}
            disabled={!isOnline}
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
              isOnline
                ? 'bg-surface-card hover:bg-surface-hover text-content-primary border border-border-default hover:border-border-default cursor-pointer active:scale-95 shadow-sm'
                : 'bg-surface-card/40 text-content-muted border border-border-subtle opacity-40 cursor-not-allowed'
            }`}
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
            disabled={!isOnline}
            placeholder={
              isOnline
                ? "Type a Minecraft server command (e.g. op Player, weather clear, stop)..."
                : "Server is not running. Start server to execute commands."
            }
            className="w-full pl-8 pr-4 py-2.5 bg-surface-elevated border border-border-default rounded-lg text-xs font-mono text-content-primary placeholder:text-content-muted focus:outline-none focus:border-border-default transition disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!isOnline || !inputCommand.trim()}
          className="px-5 py-2.5 bg-success hover:bg-success/80 disabled:opacity-40 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
