export type ServerStatus = 'STOPPED' | 'STARTING' | 'ONLINE' | 'STOPPING' | 'CRASHED';

export type ServerSoftwareType = 'paper' | 'purpur' | 'vanilla' | 'fabric';

export const isModdedServerSoftware = (software?: string): boolean => {
  if (!software) return false;
  const modded = ['fabric', 'forge', 'neoforge', 'quilt'];
  return modded.includes(software.toLowerCase().trim());
};

export type NetworkMode = 'cloud_relay' | 'upnp' | 'lan_only';

export interface ServerMetrics {
  cpu: number;
  memoryMb: number;
  tps: number;
  onlinePlayers: number;
  maxPlayers: number;
  uptimeSeconds: number;
}

export interface PlayerInfo {
  username: string;
  uuid?: string;
  ip?: string;
  joinedAt: number;
  isOp?: boolean;
  ping?: number;
}

export interface ServerInstanceConfig {
  id: string;
  name: string;
  serverDir: string;
  javaPath: string;
  allocatedRamGb: number;
  serverSoftware: ServerSoftwareType;
  version: string;
  useAikarFlags: boolean;
  port: number;
  isCracked: boolean;
  networkMode: NetworkMode;
  keepInventory?: boolean;
  showCoordinates?: boolean;
  onePlayerSleep?: boolean;
  disableMobGriefing?: boolean;
  disableFireSpread?: boolean;
}

export interface JavaRuntime {
  path: string;
  version: string;
  majorVersion: number;
  isDefault: boolean;
  vendor: string;
}

export interface UpnpStatus {
  isSupported: boolean;
  isActive: boolean;
  externalIp: string | null;
  mappedPort: number | null;
  routerName?: string | null;
  error?: string | null;
  unsupportedReason?: string | null;
}

export interface CloudTunnelStatus {
  isActive: boolean;
  status: 'STOPPED' | 'STARTING' | 'WAITING_CLAIM' | 'ONLINE' | 'ERROR';
  claimUrl: string | null;
  serverAddress: string | null;
  bedrockAddress?: string | null;
  port: number;
  error?: string | null;
}

export interface GeyserConfig {
  bedrockPort: number;
  bedrockAddress: string;
  cloneRemotePort?: boolean;
  authType: 'floodgate' | 'online' | 'offline';
  motd1: string;
  motd2: string;
  passthroughMotd: boolean;
  passthroughMaxPlayers: boolean;
}

export interface PluginInfo {
  name: string;
  filename: string;
  size: number;
  enabled: boolean;
  isCustom: boolean;
  version?: string;
  description?: string;
  icon?: string;
}

export interface PopularPlugin {
  id: string;
  name: string;
  description: string;
  category: string;
  downloadUrl: string;
  icon: string;
  recommendedForCracked?: boolean;
}

export interface ServerProperties {
  'server-port'?: number;
  'online-mode'?: boolean;
  'motd'?: string;
  'max-players'?: number;
  'difficulty'?: 'peaceful' | 'easy' | 'normal' | 'hard';
  'gamemode'?: 'survival' | 'creative' | 'adventure' | 'spectator';
  'pvp'?: boolean;
  'hardcore'?: boolean;
  'enable-command-block'?: boolean;
  'spawn-protection'?: number;
  'view-distance'?: number;
  'simulation-distance'?: number;
  'white-list'?: boolean;
  'enable-rcon'?: boolean;
  'rcon.port'?: number;
  'rcon.password'?: string;
  'allow-flight'?: boolean;
  'level-name'?: string;
  'level-seed'?: string;
  [key: string]: any;
}
