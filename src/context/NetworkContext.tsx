import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UpnpStatus, CloudTunnelStatus, NetworkMode } from '../types';
import { useServer } from './ServerContext';

interface NetworkContextType {
  upnpStatus: UpnpStatus;
  cloudTunnelStatus: CloudTunnelStatus;
  isLanBroadcasting: boolean;
  localIp: string;
  publicIp: string | null;
  isLoadingNetwork: boolean;

  // Actions
  checkUpnpSupport: (forceRefresh?: boolean) => Promise<UpnpStatus>;
  startUpnp: (port?: number) => Promise<UpnpStatus>;
  stopUpnp: () => Promise<UpnpStatus>;
  startCloudTunnel: (port?: number) => Promise<CloudTunnelStatus>;
  stopCloudTunnel: () => Promise<CloudTunnelStatus>;
  toggleLan: (motd?: string) => Promise<void>;
  applyNetworkMode: (mode: NetworkMode, serverName?: string, port?: number) => Promise<void>;
  refreshDiagnostics: (forceUpnpProbe?: boolean) => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeServer, status } = useServer();
  const [upnpStatus, setUpnpStatus] = useState<UpnpStatus>({
    isSupported: false,
    isActive: false,
    externalIp: null,
    mappedPort: null,
    routerName: null,
    error: null,
    unsupportedReason: null
  });

  const [cloudTunnelStatus, setCloudTunnelStatus] = useState<CloudTunnelStatus>({
    isActive: false,
    status: 'STOPPED',
    claimUrl: null,
    serverAddress: null,
    port: 25565,
    error: null
  });

  const [isLanBroadcasting, setIsLanBroadcasting] = useState(false);
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);

  const isInitialProbeDone = useRef(false);

  const checkUpnpSupport = useCallback(async (forceRefresh: boolean = false): Promise<UpnpStatus> => {
    if (window.electronAPI?.checkUpnpSupport) {
      try {
        const res = await window.electronAPI.checkUpnpSupport(forceRefresh);
        if (res) {
          setUpnpStatus(prev => ({
            ...prev,
            ...res,
            externalIp: res.externalIp || prev.externalIp
          }));
          if (res.externalIp) setPublicIp(res.externalIp);
          return res;
        }
      } catch (e) {
        console.error('Error probing UPnP router capability', e);
      }
    }
    return {
      isSupported: false,
      isActive: false,
      externalIp: null,
      mappedPort: null,
      error: null,
      unsupportedReason: 'UPnP is unavailable or disabled on your current network gateway.'
    };
  }, []);

  const refreshDiagnostics = useCallback(async (forceUpnpProbe: boolean = false) => {
    setIsLoadingNetwork(true);
    if (window.electronAPI) {
      try {
        const diag = await window.electronAPI.getNetworkDiagnostics();
        if (diag) {
          setLocalIp(diag.localIp || '127.0.0.1');
          if (diag.publicIp) setPublicIp(diag.publicIp);
        }

        // Check UPnP status
        if (window.electronAPI.getUpnpStatus) {
          const uStatus = await window.electronAPI.getUpnpStatus();
          if (uStatus) {
            setUpnpStatus(prev => ({ ...prev, ...uStatus }));
          }
        }

        // Probe UPnP once on mount or when explicitly forced
        if (!isInitialProbeDone.current || forceUpnpProbe) {
          isInitialProbeDone.current = true;
          await checkUpnpSupport(forceUpnpProbe);
        }

        // Check Cloud Relay status
        if (window.electronAPI.getCloudTunnelStatus) {
          const cStatus = await window.electronAPI.getCloudTunnelStatus();
          if (cStatus) {
            setCloudTunnelStatus(cStatus);
          }
        }

        // Check LAN status
        const lStatus = await window.electronAPI.getLanStatus();
        setIsLanBroadcasting(lStatus);
      } catch (e) {
        console.error('Error fetching network diagnostics', e);
      }
    } else {
      setLocalIp('192.168.1.105');
      setPublicIp('103.24.12.89');
      setUpnpStatus({
        isSupported: true,
        isActive: false,
        externalIp: '103.24.12.89',
        mappedPort: null,
        routerName: 'Archer AX50 (Demo Router)',
        error: null,
        unsupportedReason: null
      });
    }
    setIsLoadingNetwork(false);
  }, [checkUpnpSupport]);

  useEffect(() => {
    refreshDiagnostics(false);
  }, [refreshDiagnostics]);

  // Real-time IPC listener for Cloud Relay status updates
  useEffect(() => {
    if (window.electronAPI?.onCloudTunnelStatus) {
      const unsub = window.electronAPI.onCloudTunnelStatus((status: CloudTunnelStatus) => {
        if (status) {
          setCloudTunnelStatus(status);
        }
      });
      return unsub;
    }
  }, []);

  // Periodic polling fallback when Cloud Relay is starting or waiting for claim
  useEffect(() => {
    if (cloudTunnelStatus.isActive && (cloudTunnelStatus.status === 'STARTING' || cloudTunnelStatus.status === 'WAITING_CLAIM')) {
      const interval = setInterval(async () => {
        if (window.electronAPI?.getCloudTunnelStatus) {
          const updated = await window.electronAPI.getCloudTunnelStatus();
          if (updated) {
            setCloudTunnelStatus(updated);
          }
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [cloudTunnelStatus.isActive, cloudTunnelStatus.status]);

  const startUpnp = async (port: number = 25565): Promise<UpnpStatus> => {
    setIsLoadingNetwork(true);
    if (window.electronAPI?.startUpnp) {
      try {
        const res = await window.electronAPI.startUpnp({ port, protocol: 'TCP', description: 'DukeCraftora Server' });
        setUpnpStatus(res);
        if (res.externalIp) setPublicIp(res.externalIp);
        setIsLoadingNetwork(false);
        return res;
      } catch (e: any) {
        const errStatus: UpnpStatus = {
          ...upnpStatus,
          isActive: false,
          error: e.message || 'Failed to map port via UPnP'
        };
        setUpnpStatus(errStatus);
        setIsLoadingNetwork(false);
        return errStatus;
      }
    } else {
      const mock: UpnpStatus = {
        isSupported: true,
        isActive: true,
        externalIp: publicIp || '103.24.12.89',
        mappedPort: port,
        routerName: 'Demo Router Gateway',
        error: null,
        unsupportedReason: null
      };
      setUpnpStatus(mock);
      setIsLoadingNetwork(false);
      return mock;
    }
  };

  const stopUpnp = async (): Promise<UpnpStatus> => {
    if (window.electronAPI?.stopUpnp) {
      const res = await window.electronAPI.stopUpnp();
      setUpnpStatus(res);
      return res;
    } else {
      const mock: UpnpStatus = {
        ...upnpStatus,
        isActive: false,
        mappedPort: null,
        error: null
      };
      setUpnpStatus(mock);
      return mock;
    }
  };

  const startCloudTunnel = async (port: number = 25565): Promise<CloudTunnelStatus> => {
    setIsLoadingNetwork(true);
    if (window.electronAPI?.startCloudTunnel) {
      try {
        const res = await window.electronAPI.startCloudTunnel({ port });
        setCloudTunnelStatus(res);
        setIsLoadingNetwork(false);
        return res;
      } catch (e: any) {
        const errStatus: CloudTunnelStatus = {
          isActive: false,
          status: 'ERROR',
          claimUrl: null,
          serverAddress: null,
          port,
          error: e.message || 'Failed to start PlayIt.gg Tunnel'
        };
        setCloudTunnelStatus(errStatus);
        setIsLoadingNetwork(false);
        return errStatus;
      }
    } else {
      const mock: CloudTunnelStatus = {
        isActive: true,
        status: 'ONLINE',
        claimUrl: null,
        serverAddress: 'dukecraftora-demo.craft.ply.gg',
        port,
        error: null
      };
      setCloudTunnelStatus(mock);
      setIsLoadingNetwork(false);
      return mock;
    }
  };

  const stopCloudTunnel = async (): Promise<CloudTunnelStatus> => {
    if (window.electronAPI?.stopCloudTunnel) {
      const res = await window.electronAPI.stopCloudTunnel();
      setCloudTunnelStatus(res);
      return res;
    } else {
      const mock: CloudTunnelStatus = {
        isActive: false,
        status: 'STOPPED',
        claimUrl: null,
        serverAddress: null,
        port: 25565,
        error: null
      };
      setCloudTunnelStatus(mock);
      return mock;
    }
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

  const applyNetworkMode = async (
    mode: NetworkMode,
    serverName: string = 'DukeCraftora Server',
    port: number = 25565
  ): Promise<void> => {
    if (window.electronAPI) {
      if (mode === 'cloud_relay') {
        if (upnpStatus.isActive) await stopUpnp();
        if (isLanBroadcasting) {
          await window.electronAPI.stopLanBroadcast();
          setIsLanBroadcasting(false);
        }
        if (!cloudTunnelStatus.isActive) {
          await startCloudTunnel(port);
        }
      } else if (mode === 'upnp') {
        if (cloudTunnelStatus.isActive) await stopCloudTunnel();
        if (isLanBroadcasting) {
          await window.electronAPI.stopLanBroadcast();
          setIsLanBroadcasting(false);
        }
        if (!upnpStatus.isActive) {
          await startUpnp(port);
        }
      } else if (mode === 'lan_only') {
        if (cloudTunnelStatus.isActive) await stopCloudTunnel();
        if (upnpStatus.isActive) await stopUpnp();
        if (!isLanBroadcasting) {
          await window.electronAPI.startLanBroadcast({ motd: serverName, port });
          setIsLanBroadcasting(true);
        }
      }
    } else {
      // Mock mode
      if (mode === 'cloud_relay') {
        setIsLanBroadcasting(false);
        setCloudTunnelStatus({
          isActive: true,
          status: 'ONLINE',
          claimUrl: null,
          serverAddress: 'dukecraftora-demo.craft.ply.gg',
          port,
          error: null
        });
      } else if (mode === 'upnp') {
        setIsLanBroadcasting(false);
        setUpnpStatus({
          isSupported: true,
          isActive: true,
          externalIp: publicIp || '103.24.12.89',
          mappedPort: port,
          error: null
        });
      } else if (mode === 'lan_only') {
        setIsLanBroadcasting(true);
      }
    }
  };

  // Automatically start/stop configured networking when the server is started or stopped
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;

    if ((prevStatus === 'STOPPED' || prevStatus === 'CRASHED') && (status === 'STARTING' || status === 'ONLINE')) {
      if (activeServer) {
        applyNetworkMode(activeServer.networkMode, activeServer.name, activeServer.port);
      }
    } else if ((prevStatus === 'STARTING' || prevStatus === 'ONLINE') && (status === 'STOPPED' || status === 'CRASHED')) {
      if (cloudTunnelStatus.isActive) {
        stopCloudTunnel();
      }
      if (upnpStatus.isActive) {
        stopUpnp();
      }
      if (isLanBroadcasting && window.electronAPI) {
        window.electronAPI.stopLanBroadcast().then(() => setIsLanBroadcasting(false)).catch(() => {});
      }
    }
  }, [status, activeServer]);

  return (
    <NetworkContext.Provider
      value={{
        upnpStatus,
        cloudTunnelStatus,
        isLanBroadcasting,
        localIp,
        publicIp,
        isLoadingNetwork,
        checkUpnpSupport,
        startUpnp,
        stopUpnp,
        startCloudTunnel,
        stopCloudTunnel,
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
