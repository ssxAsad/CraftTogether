import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '@/components/common/GlassCard';
import { Trash2, Package, UploadCloud } from 'lucide-react';
import { useServerState } from '../../context/ServerContext';
import { useDialog } from '../../context/DialogContext';

export interface ModInfo {
  name: string;
  filename: string;
  size: number;
  enabled: boolean;
}

export const ModsTab: React.FC = () => {
  const { activeServer } = useServerState();
  const { showAlert, showConfirm } = useDialog();
  const [installed, setInstalled] = useState<ModInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!activeServer) return;
    if (window.electronAPI) {
      try {
        const inst = await window.electronAPI.getInstalledMods(activeServer.id);
        setInstalled(inst);
      } catch (e) {
        console.error('Failed to load mods', e);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [activeServer]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeServer) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      await showAlert('Invalid File', 'Please upload a valid .zip mod package.', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      if (window.electronAPI) {
        // file.path is available in Electron environments for File objects
        const filePath = (file as any).path;
        if (filePath) {
          const jarCount = await window.electronAPI.uploadModPackage({
            serverId: activeServer.id,
            zipFilePath: filePath
          });
          await loadData();
          await showAlert('Success', `Successfully extracted ${jarCount} mod(s) to the server.`, 'success');
        } else {
          await showAlert('Error', 'Could not determine file path. Please try again.', 'warning');
        }
      }
    } catch (err) {
      await showAlert('Upload Error', `Failed to extract mod package: ${err}`, 'warning');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleToggle = async (filename: string) => {
    if (!activeServer) return;
    if (window.electronAPI) {
      await window.electronAPI.toggleMod({
        serverId: activeServer.id,
        filename
      });
      await loadData();
    }
  };

  const handleDelete = async (filename: string) => {
    if (!activeServer) return;
    const confirmed = await showConfirm('Delete Mod', `Are you sure you want to permanently delete "${filename}"?`, {
      type: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (confirmed) {
      if (window.electronAPI) {
        await window.electronAPI.deleteMod({
          serverId: activeServer.id,
          filename
        });
        await loadData();
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-content-primary">Mod Manager</h1>
          <p className="text-xs text-content-secondary mt-1">Manage mods for your Forge/Fabric server</p>
        </div>

        <span className="text-xs font-semibold px-3 py-2 leading-none bg-surface-elevated text-content-primary rounded-lg border border-border-default">
          {installed.length} Installed Mods
        </span>
      </div>

      {/* Upload Section */}
      <GlassCard className="rounded-2xl p-6 border-border-default">
        <h3 className="text-sm font-bold text-content-primary flex items-center gap-2 mb-4">
          <UploadCloud className="w-5 h-5" />
          Upload a Mod Package (.zip)
        </h3>
        <p className="text-xs text-content-secondary mb-4 leading-relaxed max-w-2xl">
          Download mod files from CurseForge or Modrinth, optionally zip them into a single package, and upload the <strong>.zip</strong> here. CraftTogether will automatically extract the <code>.jar</code> files directly into your server's <code>mods/</code> folder to make them work.
        </p>

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".zip"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            id="mod-upload-input"
          />
          <label
            htmlFor="mod-upload-input"
            className={`cursor-pointer px-6 py-3 bg-success hover:bg-success/80 text-white font-bold text-sm rounded-lg flex items-center gap-2 transition ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Package className="w-4 h-4" />
            <span>{isUploading ? 'Extracting...' : 'Select .zip Package'}</span>
          </label>
        </div>
      </GlassCard>

      {/* Installed Mods Table */}
      <GlassCard className="rounded-2xl p-6 border-border-default space-y-4">
        <h3 className="text-sm font-bold text-content-primary">Installed Mods ({installed.length})</h3>

        {installed.length > 0 ? (
          <div className="divide-y divide-border-subtle">
            {installed.map((mod) => (
              <div key={mod.filename} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${mod.enabled ? 'bg-success-fg' : 'bg-content-muted'}`} />
                  <Package className="w-4 h-4 text-content-secondary" />
                  <div>
                    <span className="font-bold text-content-primary block">{mod.name}</span>
                    <span className="text-[11px] text-content-secondary font-mono">
                      {(mod.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggle(mod.filename)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${mod.enabled ? 'bg-success' : 'bg-content-muted'}`}
                    title={mod.enabled ? 'Disable Mod' : 'Enable Mod'}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${mod.enabled ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                  </button>

                  <button
                    onClick={() => handleDelete(mod.filename)}
                    className="p-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white transition shadow-sm"
                    title="Delete Mod"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 flex flex-col items-center justify-center space-y-3">
            <Package className="w-10 h-10 text-content-muted" />
            <div className="text-sm font-bold text-content-secondary">No mods installed yet</div>
            <div className="text-xs text-content-secondary max-w-sm">
              Upload a .zip package containing your .jar mods to get started!
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
