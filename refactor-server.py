import os
import re

file_path = os.path.join(os.getcwd(), 'src', 'context', 'ServerContext.tsx')
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace interface ServerContextType
content = content.replace('interface ServerContextType {', '''interface ServerState {''')

content = content.replace('''  // Actions
  startServer: () => Promise<boolean>;''', '''}

interface ServerActions {
  startServer: () => Promise<boolean>;''')

content = content.replace('''const ServerContext = createContext<ServerContextType | undefined>(undefined);''', '''const ServerStateContext = createContext<ServerState | undefined>(undefined);
const ServerActionsContext = createContext<ServerActions | undefined>(undefined);''')

# Wrap the returns in useMemo
actions_block = '''
  const actions = React.useMemo<ServerActions>(() => ({
    startServer, stopServer, killServer, sendCommand, createServer, 
    updateServerConfig, deleteServer, selectServer, clearLogs, refreshServers
  }), [activeServer, status, servers, isDownloading, refreshServers]);

  const state = React.useMemo<ServerState>(() => ({
    servers, activeServer, isLoadingServers, status, metrics, players, 
    logs, javaRuntimes, isDownloading, downloadProgress
  }), [servers, activeServer, isLoadingServers, status, metrics, players, logs, javaRuntimes, isDownloading, downloadProgress]);

  return (
    <ServerActionsContext.Provider value={actions}>
      <ServerStateContext.Provider value={state}>
        {children}
      </ServerStateContext.Provider>
    </ServerActionsContext.Provider>
  );
};'''

content = re.sub(r'  return \(\s*<ServerContext\.Provider[\s\S]*?</ServerContext\.Provider>\s*\);\s*};', actions_block, content)

# Wrap action functions in useCallback
content = content.replace('const startServer = async (): Promise<boolean> => {', 'const startServer = useCallback(async (): Promise<boolean> => {')
content = content.replace('const stopServer = async (): Promise<boolean> => {', 'const stopServer = useCallback(async (): Promise<boolean> => {')
content = content.replace('const killServer = async (): Promise<boolean> => {', 'const killServer = useCallback(async (): Promise<boolean> => {')
content = content.replace('const sendCommand = async (cmd: string): Promise<boolean> => {', 'const sendCommand = useCallback(async (cmd: string): Promise<boolean> => {')
content = content.replace('''const createServer = async (config: Omit<ServerInstanceConfig, 'id' | 'serverDir'>): Promise<void> => {''', '''const createServer = useCallback(async (config: Omit<ServerInstanceConfig, 'id' | 'serverDir'>): Promise<void> => {''')
content = content.replace('const updateServerConfig = async (serverId: string, partial: Partial<ServerInstanceConfig>): Promise<void> => {', 'const updateServerConfig = useCallback(async (serverId: string, partial: Partial<ServerInstanceConfig>): Promise<void> => {')
content = content.replace('const deleteServer = async (serverId: string): Promise<boolean> => {', 'const deleteServer = useCallback(async (serverId: string): Promise<boolean> => {')
content = content.replace('const selectServer = (server: ServerInstanceConfig) => {', 'const selectServer = useCallback((server: ServerInstanceConfig) => {')
content = content.replace('const clearLogs = () => {', 'const clearLogs = useCallback(() => {')

# Add missing array braces for useCallback dependencies
content = re.sub(r'(setTimeout\(\(\) => \{\s*setStatus\(\'ONLINE\'\);\s*setLogs\(prev => \[\.\.\.prev, \{ line: \'\[Craftora Mock\].*?\);\s*\}, 1500\);\s*return true;\s*)\};', r'\1}, [activeServer]);', content)
content = re.sub(r'(setTimeout\(\(\) => setStatus\(\'STOPPED\'\), 1000\);\s*return true;\s*)\};', r'\1}, []);', content)
content = re.sub(r'(setStatus\(\'STOPPED\'\);\s*return true;\s*)\};', r'\1}, []);', content)
content = re.sub(r'(setLogs\(prev => \[\.\.\.prev, \{ line: > \$\{cmd\}, type: \'system\' \}\]\);\s*return true;\s*)\};', r'\1}, []);', content)
content = re.sub(r'(localStorage\.setItem\(\'craftora_active_server_id\', cleanId\);\s*setIsDownloading\(false\);\s*\}, 1500\);\s*\}\s*)\};', r'\1}, [refreshServers]);', content)
content = re.sub(r'(setActiveServer\(prev => prev && prev\.id === serverId \? \{ \.\.\.prev, \.\.\.partial \} : prev\);\s*)\};', r'\1}, []);', content)
content = re.sub(r'(await refreshServers\(\);\s*return true;\s*)\};', r'\1}, [status, activeServer, servers, refreshServers]);', content)
content = re.sub(r'(localStorage\.setItem\(\'craftora_active_server_id\', server\.id\);\s*setLogs\(\[\]\);\s*)\};', r'\1}, [status, activeServer]);', content)
content = re.sub(r'(setLogs\(\[\]\);\s*)\};', r'\1}, []);', content)

hooks = '''
export const useServerState = () => {
  const context = useContext(ServerStateContext);
  if (!context) throw new Error('useServerState must be used within a ServerProvider');
  return context;
};

export const useServerActions = () => {
  const context = useContext(ServerActionsContext);
  if (!context) throw new Error('useServerActions must be used within a ServerProvider');
  return context;
};
'''

content = re.sub(r'export const useServer = \(\) => \{[\s\S]*', hooks, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated ServerContext.tsx')
