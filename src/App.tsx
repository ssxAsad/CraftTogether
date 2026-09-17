import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, MainTabType } from './components/layout/Sidebar';
import { ServersTab } from './components/servers/ServersTab';
import { CreateServerModal } from './components/modals/CreateServerModal';
const ConsoleTab = React.lazy(() => import('./components/console/ConsoleTab').then(m => ({ default: m.ConsoleTab })));
import { FirstLaunchScreen } from './components/onboarding/FirstLaunchScreen';
import { useServerState, useServerActions } from './context/ServerContext';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MainTabType>('servers');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [setupStep, setSetupStep] = useState<'directory' | 'dependencies' | 'playit'>('directory');
  const [storageDirectory, setStorageDirectory] = useState<string>('');
  const { refreshServers } = useServerActions();

  useEffect(() => {
    const checkSetup = async () => {
      if (window.electronAPI) {
        try {
          const status = await window.electronAPI.getSetupStatus();
          setIsSetupComplete(status.isSetupComplete);
          if (!status.isSetupComplete) {
            setSetupStep((status.setupStep as any) || 'directory');
            setStorageDirectory(status.storageDirectory || '');
          }
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
    if (window.electronAPI?.completeSetup) {
      await window.electronAPI.completeSetup();
    } else {
      localStorage.setItem('craftora_setup_complete', 'true');
    }
    setIsSetupComplete(true);
    await refreshServers();
  };

  // Loading setup check state
  if (isSetupComplete === null) {
    return (
      <div className="flex h-screen w-screen bg-surface-base items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-surface-base text-content-primary overflow-hidden select-none font-sans">
      {/* Main View: First Launch Splash or App Layout */}
      {!isSetupComplete ? (
        <div className="flex flex-col flex-1 h-full w-full">
          <TitleBar />
          <FirstLaunchScreen
            onComplete={handleSetupComplete}
            initialStep={setupStep}
            initialDirectory={storageDirectory}
          />
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

            <main className="flex-1 bg-surface-base overflow-hidden relative border-l border-border-subtle">
              <div className={`h-full ${activeTab === 'servers' ? 'block' : 'hidden'}`}>
                <ServersTab
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                  onNavigateToConsole={() => setActiveTab('console')}
                />
              </div>
              <div className={`h-full ${activeTab === 'console' ? 'block' : 'hidden'}`}>
                <React.Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-8 h-8 rounded-full border-2 border-border-default border-t-transparent animate-spin" /></div>}>
                  <ConsoleTab />
                </React.Suspense>
              </div>
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
