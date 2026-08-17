import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { NgrokStatus, NetworkMode } from '../types';

interface NetworkContextType {
  ngrokStatus: NgrokStatus;
  isLanBroadcasting: boolean;
  localIp: string;
  publicIp: string | null;
  isLoadingNetwork: boolean;

  // Actions
  startNgrok: (authToken?: string) => Promise<NgrokStatus>;
  stopNgrok: () => Promise<NgrokStatus>;
  saveNgrokToken: (token: string) => Promise<boolean>;
  toggleLan: (motd?: string) => Promise<void>;
  applyNetworkMode: (mode: NetworkMode, serverName?: string, port?: number) => Promise<void>;
  refreshDiagnostics: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ngrokStatus, setNgrokStatus] = useState<NgrokStatus>({
    isActive: false,
    publicUrl: null,
    serverAddress: null,
    port: 25565,
    authToken: '',
    error: null
  });

  const [isLanBroadcasting, setIsLanBroadcasting] = useState(false);
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);

  const refreshDiagnostics = useCallback(async () => {
    setIsLoadingNetwork(true);
    if (window.electronAPI) {
      try {
        const diag = await window.electronAPI.getNetworkDiagnostics();
        if (diag) {
          setLocalIp(diag.localIp || '127.0.0.1');
          setPublicIp(diag.publicIp || null);
        }

        const savedToken = await window.electronAPI.getNgrokToken();
        const nStatus = await window.electronAPI.getNgrokStatus();
        setNgrokStatus({ ...nStatus, authToken: savedToken || nStatus.authToken });

        const lStatus = await window.electronAPI.getLanStatus();
        setIsLanBroadcasting(lStatus);
      } catch (e) {
        console.error('Error fetching network diagnostics', e);
      }
    } else {
      setLocalIp('192.168.1.105');
      setPublicIp('103.24.12.89');
    }
    setIsLoadingNetwork(false);
  }, []);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics]);

  const startNgrok = async (authToken?: string): Promise<NgrokStatus> => {
    setIsLoadingNetwork(true);
    if (window.electronAPI) {
      const res = await window.electronAPI.startNgrok({ port: 25565, authToken });
      setNgrokStatus(res);
      setIsLoadingNetwork(false);
      return res;
    } else {
      const mock: NgrokStatus = {
        isActive: true,
        publicUrl: 'tcp://4.tcp.ngrok.io:19423',
        serverAddress: '4.tcp.ngrok.io:19423',
        port: 25565,
        authToken: authToken || 'demo-token',
        error: null
      };
      setNgrokStatus(mock);
      setIsLoadingNetwork(false);
      return mock;
    }
  };

  const stopNgrok = async (): Promise<NgrokStatus> => {
    if (window.electronAPI) {
      const res = await window.electronAPI.stopNgrok();
      setNgrokStatus(res);
      return res;
    } else {
      const mock: NgrokStatus = {
        isActive: false,
        publicUrl: null,
        serverAddress: null,
        port: 25565,
        authToken: ngrokStatus.authToken,
        error: null
      };
      setNgrokStatus(mock);
      return mock;
    }
  };

  const saveNgrokToken = async (token: string): Promise<boolean> => {
    if (window.electronAPI) {
      await window.electronAPI.saveNgrokToken(token);
    }
    setNgrokStatus(prev => ({ ...prev, authToken: token }));
    return true;
  };

  const toggleLan = async (motd: string = 'DukeCraftora LAN'): Promise<void> => {
    if (window.electronAPI) {
      if (isLanBroadcasting) {
        await window.electronAPI.stopLanBroadcast();
        setIsLanBroadcasting(false);
      } else {
        await window.electronAPI.startLanBroadcast({ motd, port: 25565 });
        setIsLanBroadcasting(true);
      }
    } else {
      setIsLanBroadcasting(!isLanBroadcasting);
    }
  };

  const applyNetworkMode = async (mode: NetworkMode, serverName: string = 'DukeCraftora Server', port: number = 25565): Promise<void> => {
    if (window.electronAPI) {
      // 1. LAN Discovery is active in all modes
      if (!isLanBroadcasting) {
        await window.electronAPI.startLanBroadcast({ motd: serverName, port });
        setIsLanBroadcasting(true);
      }

      // 2. Mode specific actions
      if (mode === 'ngrok_lan') {
        const savedToken = await window.electronAPI.getNgrokToken();
        if (savedToken && !ngrokStatus.isActive) {
          await startNgrok(savedToken);
        }
      } else if (mode === 'lan_only') {
        if (ngrokStatus.isActive) {
          await stopNgrok();
        }
      }
    } else {
      // Mock mode
      setIsLanBroadcasting(true);
      if (mode === 'ngrok_lan') {
        setNgrokStatus(prev => ({
          ...prev,
          isActive: true,
          serverAddress: '4.tcp.ngrok.io:19423',
          publicUrl: 'tcp://4.tcp.ngrok.io:19423'
        }));
      } else {
        setNgrokStatus(prev => ({ ...prev, isActive: false, serverAddress: null }));
      }
    }
  };

  return (
    <NetworkContext.Provider
      value={{
        ngrokStatus,
        isLanBroadcasting,
        localIp,
        publicIp,
        isLoadingNetwork,
        startNgrok,
        stopNgrok,
        saveNgrokToken,
        toggleLan,
        applyNetworkMode,
        refreshDiagnostics
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

