import os
import re

file_path = os.path.join(os.getcwd(), 'src', 'context', 'NetworkContext.tsx')
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace interface NetworkContextType
content = content.replace('interface NetworkContextType {', '''interface NetworkState {''')

content = content.replace('''  // Actions
  checkUpnpSupport: (forceRefresh?: boolean) => Promise<UpnpStatus>;''', '''}

interface NetworkActions {
  checkUpnpSupport: (forceRefresh?: boolean) => Promise<UpnpStatus>;''')

content = content.replace('''const NetworkContext = createContext<NetworkContextType | undefined>(undefined);''', '''const NetworkStateContext = createContext<NetworkState | undefined>(undefined);
const NetworkActionsContext = createContext<NetworkActions | undefined>(undefined);''')

actions_block = '''
  const actions = React.useMemo<NetworkActions>(() => ({
    checkUpnpSupport, startUpnp, stopUpnp, startCloudTunnel, stopCloudTunnel, 
    toggleLan, applyNetworkMode, refreshDiagnostics
  }), [checkUpnpSupport, startUpnp, stopUpnp, startCloudTunnel, stopCloudTunnel, toggleLan, applyNetworkMode, refreshDiagnostics]);

  const state = React.useMemo<NetworkState>(() => ({
    upnpStatus, cloudTunnelStatus, isLanBroadcasting, localIp, publicIp, isLoadingNetwork
  }), [upnpStatus, cloudTunnelStatus, isLanBroadcasting, localIp, publicIp, isLoadingNetwork]);

  return (
    <NetworkActionsContext.Provider value={actions}>
      <NetworkStateContext.Provider value={state}>
        {children}
      </NetworkStateContext.Provider>
    </NetworkActionsContext.Provider>
  );
};'''

content = re.sub(r'  return \(\s*<NetworkContext\.Provider[\s\S]*?</NetworkContext\.Provider>\s*\);\s*};', actions_block, content)

hooks = '''
export const useNetworkState = () => {
  const context = useContext(NetworkStateContext);
  if (!context) throw new Error('useNetworkState must be used within a NetworkProvider');
  return context;
};

export const useNetworkActions = () => {
  const context = useContext(NetworkActionsContext);
  if (!context) throw new Error('useNetworkActions must be used within a NetworkProvider');
  return context;
};
'''

content = re.sub(r'export const useNetwork = \(\) => \{[\s\S]*', hooks, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated NetworkContext.tsx')
