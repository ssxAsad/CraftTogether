import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, MainTabType } from './components/layout/Sidebar';
import { ServersTab } from './components/servers/ServersTab';
import { ConsoleTab } from './components/console/ConsoleTab';
import { CreateServerModal } from './components/modals/CreateServerModal';
import { FirstLaunchScreen } from './components/onboarding/FirstLaunchScreen';
import { useServer } from './context/ServerContext';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTabType>('servers');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const { refreshServers } = useServer();

  useEffect(() => {
    const checkSetup = async () => {
      if (window.electronAPI) {
        try {
          const status = await window.electronAPI.getSetupStatus();
          setIsSetupComplete(status.isSetupComplete);
        } catch (e) {
          setIsSetupComplete(true);
        }
      } else {
        const stored = localStorage.getItem('craftora_setup_complete');
        setIsSetupComplete(stored === 'true');
      }
    };
    checkSetup();
  }, []);

  const handleSetupComplete = async (chosenDirectory: string) => {
    if (!window.electronAPI) {
      localStorage.setItem('craftora_setup_complete', 'true');
    }
    setIsSetupComplete(true);
    await refreshServers();
  };

  // Loading setup check state
  if (isSetupComplete === null) {
    return (
      <div className="flex h-screen w-screen bg-obsidian-950 items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-obsidian-950 text-slate-100 overflow-hidden select-none font-sans">
      {/* Main View: First Launch Splash or App Layout */}
      {!isSetupComplete ? (
        <div className="flex flex-col flex-1 h-full w-full">
          <TitleBar />
          <FirstLaunchScreen onComplete={handleSetupComplete} />
        </div>
      ) : (
        <div className="flex flex-1 h-full w-full overflow-hidden">
          {/* Full-height Unified Sidebar with title and logo at top */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />

          {/* Right Column: Titlebar drag strip/controls + Dynamic Tab Body */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <TitleBar />

            <main className="flex-1 bg-obsidian-950 overflow-hidden relative">
              {activeTab === 'servers' ? (
                <ServersTab
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                  onNavigateToConsole={() => setActiveTab('console')}
                />
              ) : (
                <ConsoleTab />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Complete Step-by-Step Server Creation Wizard Modal */}
      <CreateServerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
