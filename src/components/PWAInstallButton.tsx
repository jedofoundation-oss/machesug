import React, { useState } from 'react';
import { Check, Copy, Download, MoreVertical, Share, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { Modal } from './Modal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [platformTab, setPlatformTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setPlatformTab(isIOS ? 'ios' : 'android');
    setGuideOpen(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard fallback ignored
    }
  };

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-md transition-colors whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>Install Phone App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
          title="Install full-screen app on Android or iPhone"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install App</span>
        </button>
      )}

      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Install Full-Screen Mobile App"
        subtitle="Add MachesHMS to your Android or iPhone home screen for full-screen clinical access."
      >
        <div className="space-y-4">
          {/* Platform Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setPlatformTab('android')}
              className={`py-2 text-xs font-semibold rounded transition-colors ${
                platformTab === 'android'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setPlatformTab('ios')}
              className={`py-2 text-xs font-semibold rounded transition-colors ${
                platformTab === 'ios'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              iPhone / iPad (Safari)
            </button>
          </div>

          {platformTab === 'android' ? (
            <div className="space-y-3 text-xs text-slate-700">
              {isInstallable && (
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-md flex items-center justify-between gap-3">
                  <span className="font-medium text-teal-900">
                    Your browser supports direct one-tap installation.
                  </span>
                  <button
                    type="button"
                    onClick={install}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded whitespace-nowrap shrink-0"
                  >
                    Install Now
                  </button>
                </div>
              )}
              <ol className="space-y-2.5 list-decimal list-inside">
                <li>
                  Open this page directly in <strong>Google Chrome</strong> on your Android phone.
                </li>
                <li className="flex items-start gap-1.5">
                  <span>
                    2. Tap the{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-medium">
                      <MoreVertical className="w-3 h-3 mr-0.5" /> Menu
                    </span>{' '}
                    icon in the top-right corner of Chrome.
                  </span>
                </li>
                <li>
                  Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>) and
                  confirm <strong>Install</strong>.
                </li>
              </ol>
              <p className="text-[11px] text-slate-500">
                MachesHMS will launch in full-screen standalone mode without the browser address bar.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-slate-700">
              <ol className="space-y-2.5">
                <li>
                  1. Open this page in <strong>Safari</strong> on your iPhone or iPad (iOS Safari is
                  required for home-screen installation).
                </li>
                <li>
                  2. Tap the{' '}
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-medium">
                    <Share className="w-3 h-3 mr-1 text-teal-700" /> Share
                  </span>{' '}
                  button in Safari&apos;s bottom toolbar.
                </li>
                <li>
                  3. Scroll down and tap <strong>Add to Home Screen</strong>, then tap{' '}
                  <strong>Add</strong> in the top-right corner.
                </li>
              </ol>
              <p className="text-[11px] text-slate-500">
                Opening MachesHMS from your iPhone Home Screen launches it full-screen like a native
                hospital app.
              </p>
            </div>
          )}

          {/* Direct Phone URL Copy Helper */}
          <div className="pt-3 border-t border-slate-100 space-y-1.5">
            <div className="text-[11px] font-medium text-slate-500">
              Opening on your phone? Copy the direct app link:
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={typeof window !== 'undefined' ? window.location.origin : ''}
                className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-slate-700 truncate"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white shadow-lg no-print">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Cached hospital shell active</span>
    </div>
  );
};
