import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { PlaceholderIcon } from '@/components/common/PlaceholderIcon';
import { PlayItIcon } from '../common/Icons';

interface PlayitSetupScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

type ClaimState = 'idle' | 'starting' | 'waiting_claim' | 'claimed';

export const PlayitSetupScreen: React.FC<PlayitSetupScreenProps> = ({ onComplete, onBack }) => {
  const [tunnelStatus, setTunnelStatus] = useState<any>({ status: 'STOPPED', isActive: false });
  const [claimUrl, setClaimUrl] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const hasFiredConfetti = useRef(false);

  // Derive state variables
  const isAgentLinked = tunnelStatus.status === 'ONLINE';
  const isTunnelReady = isAgentLinked && Boolean(tunnelStatus.serverAddress);

  useEffect(() => {
    if (isTunnelReady && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true;
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#34d399', '#10b981', '#059669', '#ffffff']
      });
    }
  }, [isTunnelReady]);

  // Listen to real-time tunnel status updates from the main process
  useEffect(() => {
    const fetchStatus = async () => {
      if (window.electronAPI?.getCloudTunnelStatus) {
        try {
          const res = await window.electronAPI.getCloudTunnelStatus();
          setTunnelStatus(res);
          if (res.status === 'WAITING_CLAIM' && res.claimUrl) {
            setClaimUrl(res.claimUrl);
            setClaimState('waiting_claim');
          } else if (res.status === 'ONLINE') {
            setClaimState('claimed');
          }
        } catch {}
      }
    };
    fetchStatus();

    let unlisten: (() => void) | undefined;
    if (window.electronAPI?.onCloudTunnelStatus) {
      unlisten = window.electronAPI.onCloudTunnelStatus((status: any) => {
        setTunnelStatus(status);

        if (status.status === 'WAITING_CLAIM' && status.claimUrl) {
          setClaimUrl(status.claimUrl);
          setClaimState('waiting_claim');
          setErrorMessage(null);
        } else if (status.status === 'ONLINE') {
          setClaimUrl(null);
          setClaimState('claimed');
          setErrorMessage(null);
        } else if (status.status === 'ERROR') {
          setErrorMessage(status.error || 'Something went wrong. Please try again.');
          setClaimState('idle');
        }
      });
    }

    return () => { if (unlisten) unlisten(); };
  }, []);

  const handleLinkAccount = async () => {
    setClaimState('starting');
    setErrorMessage(null);
    setClaimUrl(null);
    try {
      if (window.electronAPI?.startCloudTunnel) {
        await window.electronAPI.startCloudTunnel();
        // Status updates will arrive via the onCloudTunnelStatus listener above
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to start the claim process.');
      setClaimState('idle');
    }
  };

  const handleCopyClaimUrl = () => {
    if (!claimUrl) return;
    navigator.clipboard.writeText(claimUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleReopenBrowser = () => {
    if (claimUrl && window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(claimUrl);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-y-auto max-h-screen">

      {/* Step Indicator Header */}
      <div className="text-center mb-6 pt-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-200 text-xs font-bold uppercase tracking-wider mb-3">
          <PlaceholderIcon className="w-3.5 h-3.5" />
          <span>Step 2 of 2: Global Multiplayer Setup</span>
        </div>
        <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
          PlayIt.gg Tunnel Setup
        </h2>
        <p className="text-slate-400 text-sm max-w-xl mx-auto">
          Play with friends across the internet for free. PlayIt assigns a public server address without touching your router.
        </p>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
        {[
          {
            icon: <PlaceholderIcon className="w-5 h-5" />,
            title: 'Universal Internet Play',
            desc: 'Works on any ISP, including restrictive CGNAT networks.'
          },
          {
            icon: <PlaceholderIcon className="w-5 h-5" />,
            title: 'Private IP Shield',
            desc: 'Hides your home IP with built-in DDoS protection.'
          },
          {
            icon: <PlaceholderIcon className="w-5 h-5" />,
            title: 'Zero Router Config',
            desc: 'No port forwarding, no router login, no static IP needed.'
          }
        ].map((item) => (
          <div key={item.title} className="bg-obsidian-900/60 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-slate-200 flex items-center justify-center shrink-0">
              {item.icon}
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">{item.title}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Card */}
      <div className="bg-obsidian-900 border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
        {/* Card Header */}
        <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-5">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center p-2 shadow-md shrink-0">
            <PlayItIcon className="w-11 h-11 rounded-xl" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-white">PlayIt.gg Account Link</h3>
              {isAgentLinked ? (
                <span className="flex items-center gap-1 text-xs font-bold text-white bg-obsidian-950 px-2.5 py-0.5 rounded border border-white/10">
                  <PlaceholderIcon className="w-3.5 h-3.5" />
                  Linked & Active
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded border border-amber-500/30">
                  Not Linked
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isTunnelReady
                ? 'Your tunnel agent is authenticated and ready to route game traffic globally.'
                : isAgentLinked && !isTunnelReady
                ? 'Your agent is linked, but you need to create a tunnel.'
                : 'Link this agent to your PlayIt.gg account. It takes less than a minute!'}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Content Area */}
        {isTunnelReady ? (
          /* === SUCCESS STATE: Linked and Tunnel Exists === */
          <div className="bg-obsidian-950 border border-white/10 rounded-xl p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-white/5 text-slate-200 flex items-center justify-center mx-auto border border-white/10">
              <PlaceholderIcon className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Setup Complete!</h4>
              <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                Your server is now successfully connected to the internet. You can start your server from the dashboard and share the address below with your friends.
              </p>
              <div className="mt-3 px-4 py-2 bg-emerald-900/40 border border-white/10 rounded-lg inline-block">
                <p className="text-xs text-slate-400 mb-0.5">Your Public Address</p>
                <code className="text-sm font-mono font-bold text-white">
                  {tunnelStatus.serverAddress}
                </code>
              </div>
              
              {!tunnelStatus.bedrockAddress && (
                <div className="mt-5 p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-left text-xs text-blue-200 leading-relaxed max-w-md mx-auto">
                  <strong className="text-white block mb-1">Hosting for mobile/console players?</strong>
                  To allow Minecraft Bedrock players to join over the internet, you must go to your <button onClick={() => window.electronAPI?.openExternal('https://playit.gg/account/tunnels')} className="text-blue-400 hover:underline font-semibold cursor-pointer">PlayIt Tunnels Dashboard</button> and click <strong>Add Tunnel &rarr; Minecraft Bedrock</strong>. Ensure the <strong>Local Port</strong> is set to <strong>25565</strong>.
                </div>
              )}
            </div>
          </div>
        ) : isAgentLinked && !isTunnelReady ? (
          /* === SUCCESS BUT NO TUNNEL: Linked but no tunnel added === */
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <PlaceholderIcon className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Checking for Tunnel...</h4>
              <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
                We've successfully connected to your PlayIt account! Now, please ensure you have added a Minecraft Java tunnel on the PlayIt website and assigned it to this new agent.
              </p>
              <p className="text-xs text-blue-300 mt-3 max-w-md mx-auto leading-relaxed bg-blue-950/30 p-2 rounded-lg border border-blue-500/20">
                <strong>Tip for Bedrock Cross-play:</strong> If you want mobile players to join, add a second <strong>Minecraft Bedrock</strong> tunnel and set its Local Port to <strong>25565</strong>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal('https://playit.gg/account/tunnels');
                  } else {
                    window.open('https://playit.gg/account/tunnels', '_blank');
                  }
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Open Dashboard <PlaceholderIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (window.electronAPI?.getCloudTunnelStatus) {
                    window.electronAPI.getCloudTunnelStatus().then((res: any) => setTunnelStatus(res));
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-obsidian-800 hover:bg-obsidian-700 text-white font-bold rounded-xl text-sm transition-all border border-white/10 cursor-pointer"
              >
                <PlaceholderIcon className="w-4 h-4" /> Refresh
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              This screen will automatically update as soon as the tunnel is detected.
            </p>
          </div>
        ) : claimState === 'idle' ? (

          /* === IDLE STATE: Show single Link button === */
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="text-center max-w-sm">
              <p className="text-sm text-slate-300 leading-relaxed">
                Click <strong className="text-white">Link PlayIt.gg Account</strong> below. Your browser will open automatically — just log in to PlayIt.gg and click the <strong className="text-slate-200">Claim Agent</strong> button. That's it.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              <button
                type="button"
                onClick={handleLinkAccount}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-obsidian-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <PlaceholderIcon className="w-4 h-4" />
                <span>Link PlayIt.gg Account</span>
              </button>
              <p className="text-[11px] text-slate-500 text-center">
                A free PlayIt.gg account is required. Takes less than a minute!
              </p>
            </div>
          </div>

        ) : claimState === 'starting' ? (
          /* === STARTING: Spawning the agent === */
          <div className="flex flex-col items-center gap-4 py-8">
            <PlaceholderIcon className="w-8 h-8 text-slate-200 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-white">Starting PlayIt.gg Agent...</p>
              <p className="text-xs text-slate-400 mt-1">Generating your secure claim link, please wait.</p>
            </div>
          </div>

        ) : claimState === 'waiting_claim' ? (
          /* === WAITING: Browser opened, waiting for user click === */
          <div className="space-y-5">
            {/* Step pills */}
            <div className="flex items-center gap-3 justify-center flex-wrap">
              {[
                { n: '1', label: 'Agent Started', done: true },
                { n: '2', label: 'Browser Opened', done: true },
                { n: '3', label: 'Waiting for Claim', done: false, active: true },
                { n: '4', label: 'Done!', done: false }
              ].map((step) => (
                <div key={step.n} className={`flex items-center gap-1.5 px-3 py-2 leading-none rounded-full border text-[11px] font-bold
                  ${step.done ? 'bg-obsidian-950 border-white/10 text-white' :
                    step.active ? 'bg-amber-950/50 border-amber-500/40 text-amber-300' :
                    'bg-white/5 border-white/10 text-slate-500'}`}>
                  {step.done ? (
                    <PlaceholderIcon className="w-3 h-3" />
                  ) : step.active ? (
                    <PlaceholderIcon className="w-3 h-3 animate-spin" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[9px]">{step.n}</span>
                  )}
                  {step.label}
                </div>
              ))}
            </div>

            {/* Instruction box */}
            <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4 text-center">
              <p className="text-sm text-blue-200 font-semibold mb-1">
                Your browser should be open now!
              </p>
              <p className="text-xs text-slate-400">
                Log into your PlayIt.gg account if prompted, then click the green{' '}
                <strong className="text-slate-200">"Claim Agent"</strong>{' '}
                button on the page. Craftora will detect it automatically.
              </p>
            </div>

            {/* Claim URL display */}
            {claimUrl && (
              <div className="bg-zinc-900/80 border border-white/10 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Claim URL (browser should have opened automatically)</span>
                  <button
                    type="button"
                    onClick={handleCopyClaimUrl}
                    className="text-slate-200 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {copiedUrl ? <PlaceholderIcon className="w-3 h-3" /> : <PlaceholderIcon className="w-3 h-3" />}
                    {copiedUrl ? 'Copied' : 'PlaceholderIcon'}
                  </button>
                </div>
                <code className="text-xs text-white font-mono block break-all select-all">
                  {claimUrl}
                </code>
              </div>
            )}

            {/* Re-open browser button */}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleReopenBrowser}
                className="px-4 py-2 bg-white/5 hover:bg-white/5 text-white border border-white/10 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <PlaceholderIcon className="w-3.5 h-3.5" />
                Re-open in Browser
              </button>
              <button
                type="button"
                onClick={() => { setClaimState('idle'); setClaimUrl(null); }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-2 transition cursor-pointer"
        >
          <PlaceholderIcon className="w-4 h-4" />
          <span>Back to Dependencies</span>
        </button>

        <div className="flex items-center gap-3">
          {!isTunnelReady && claimState !== 'waiting_claim' && (
            <button
              type="button"
              onClick={onComplete}
              className="px-4 py-2.5 text-slate-400 hover:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Skip (LAN / UPnP only)
            </button>
          )}

          <button
            type="button"
            onClick={onComplete}
            disabled={!isTunnelReady}
            className={`px-6 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg ${
              isTunnelReady
                ? 'bg-emerald-500 hover:bg-emerald-600 text-obsidian-950 cursor-pointer'
                : 'bg-white/5 text-slate-300 cursor-not-allowed'
            }`}
          >
            <span>Complete Setup</span>
            <PlaceholderIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
