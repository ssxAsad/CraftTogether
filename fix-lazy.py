import os
import re

# Refactor App.tsx
app_path = os.path.join(os.getcwd(), 'src', 'App.tsx')
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

app_content = app_content.replace(
    "import { ConsoleTab } from './components/console/ConsoleTab';",
    "const ConsoleTab = React.lazy(() => import('./components/console/ConsoleTab').then(m => ({ default: m.ConsoleTab })));"
)

app_content = app_content.replace(
    "<ConsoleTab />",
    "<React.Suspense fallback={<div className=\\"flex items-center justify-center h-full w-full\\"><div className=\\"w-8 h-8 rounded-full border-2 border-border-default border-t-transparent animate-spin\\" /></div>}><ConsoleTab /></React.Suspense>"
)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)

# Refactor ServersTab.tsx
servers_path = os.path.join(os.getcwd(), 'src', 'components', 'servers', 'ServersTab.tsx')
with open(servers_path, 'r', encoding='utf-8') as f:
    servers_content = f.read()

servers_content = servers_content.replace(
    "import { DashboardTab } from '../dashboard/DashboardTab';",
    "const DashboardTab = React.lazy(() => import('../dashboard/DashboardTab').then(m => ({ default: m.DashboardTab })));"
)
servers_content = servers_content.replace(
    "import { NetworkTab } from '../network/NetworkTab';",
    "const NetworkTab = React.lazy(() => import('../network/NetworkTab').then(m => ({ default: m.NetworkTab })));"
)
servers_content = servers_content.replace(
    "import { ConfigTab } from '../config/ConfigTab';",
    "const ConfigTab = React.lazy(() => import('../config/ConfigTab').then(m => ({ default: m.ConfigTab })));"
)
servers_content = servers_content.replace(
    "import { PlayersTab } from '../players/PlayersTab';",
    "const PlayersTab = React.lazy(() => import('../players/PlayersTab').then(m => ({ default: m.PlayersTab })));"
)
servers_content = servers_content.replace(
    "import { PluginsTab } from '../plugins/PluginsTab';",
    "const PluginsTab = React.lazy(() => import('../plugins/PluginsTab').then(m => ({ default: m.PluginsTab })));"
)

render_func = '''  const renderSubTab = () => {
    switch (activeSubTab) {
      case 'overview':
        return <DashboardTab onNavigateTab={(tab) => {
          if (tab === 'console') onNavigateToConsole();
          else setActiveSubTab(tab as ServerSubTabType);
        }} />;
      case 'network':
        return <NetworkTab />;
      case 'plugins':
        return <PluginsTab />;
      case 'players':
        return <PlayersTab />;
      case 'config':
        return <ConfigTab />;
      default:
        return <DashboardTab onNavigateTab={(tab) => {
          if (tab === 'console') onNavigateToConsole();
          else setActiveSubTab(tab as ServerSubTabType);
        }} />;
    }
  };'''

new_render_func = '''  const renderSubTab = () => {
    let content;
    switch (activeSubTab) {
      case 'overview':
        content = <DashboardTab onNavigateTab={(tab) => {
          if (tab === 'console') onNavigateToConsole();
          else setActiveSubTab(tab as ServerSubTabType);
        }} />;
        break;
      case 'network':
        content = <NetworkTab />;
        break;
      case 'plugins':
        content = <PluginsTab />;
        break;
      case 'players':
        content = <PlayersTab />;
        break;
      case 'config':
        content = <ConfigTab />;
        break;
      default:
        content = <DashboardTab onNavigateTab={(tab) => {
          if (tab === 'console') onNavigateToConsole();
          else setActiveSubTab(tab as ServerSubTabType);
        }} />;
        break;
    }
    
    return (
      <React.Suspense fallback={
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-border-default border-t-transparent animate-spin" />
          <p className="text-xs text-content-secondary font-medium">Loading component...</p>
        </div>
      }>
        {content}
      </React.Suspense>
    );
  };'''

servers_content = servers_content.replace(render_func, new_render_func)

with open(servers_path, 'w', encoding='utf-8') as f:
    f.write(servers_content)

print('Lazy loading implemented')
