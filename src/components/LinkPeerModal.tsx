import React, { useState } from 'react';
import { X, Copy, Check, Link2, ExternalLink, RefreshCw, Trash2, Users } from 'lucide-react';

interface LinkPeerModalProps {
  isOpen: boolean;
  onClose: () => void;
  myPeerId: string;
  isLinked: boolean;
  onConnect: (peerId: string) => void;
  onClearChat: () => void;
}

export const LinkPeerModal: React.FC<LinkPeerModalProps> = ({
  isOpen,
  onClose,
  myPeerId,
  isLinked,
  onConnect,
  onClearChat,
}) => {
  const [remoteId, setRemoteId] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleCopyId = () => {
    if (!myPeerId) return;
    navigator.clipboard.writeText(myPeerId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyLink = () => {
    if (!myPeerId) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?connect=${myPeerId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenSecondTab = () => {
    const url = `${window.location.origin}${window.location.pathname}?connect=${myPeerId}`;
    window.open(url, '_blank');
  };

  const handleSubmitConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteId.trim()) return;
    onConnect(remoteId.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-pop-in">
      <div className="w-full max-w-md bg-[#160f2e] border border-purple-500/30 rounded-3xl p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-purple-300 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/20">
            <Users size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Link with Friend</h3>
            <p className="text-xs text-purple-300/70">
              Direct Peer-to-Peer encrypted connection
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`mb-5 p-3 rounded-2xl flex items-center justify-between text-xs font-semibold ${
            isLinked
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-purple-950/50 border border-purple-500/20 text-purple-300'
          }`}
        >
          <span>Connection Status:</span>
          <span className="flex items-center gap-1.5 font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                isLinked ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`}
            />
            {isLinked ? 'Linked & Ready' : 'Waiting for connection'}
          </span>
        </div>

        {/* Your Peer ID Section */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-purple-200 mb-1.5">
            Your Peer ID:
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-purple-100 select-all truncate">
              {myPeerId || 'Generating ID...'}
            </div>
            <button
              onClick={handleCopyId}
              disabled={!myPeerId}
              className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {copiedId ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedId ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Share Direct Link Button */}
        <div className="mb-5 flex gap-2">
          <button
            onClick={handleCopyLink}
            disabled={!myPeerId}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 border border-white/10 transition-all active:scale-95 disabled:opacity-50"
          >
            {copiedLink ? <Check size={14} /> : <Link2 size={14} />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
          </button>

          <button
            onClick={handleOpenSecondTab}
            disabled={!myPeerId}
            className="px-3 py-2.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            title="Open in new tab to test dual chat right now"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Test 2nd Tab</span>
          </button>
        </div>

        {/* Connect to Friend Input */}
        <form onSubmit={handleSubmitConnect} className="mb-5">
          <label className="block text-xs font-semibold text-purple-200 mb-1.5">
            Connect to Friend's Peer ID:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={remoteId}
              onChange={(e) => setRemoteId(e.target.value)}
              placeholder="Paste friend's Peer ID here"
              className="flex-1 bg-black/40 border border-white/10 focus:border-purple-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none font-mono"
            />
            <button
              type="submit"
              disabled={!remoteId.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold text-xs rounded-xl shadow-md active:scale-95 disabled:opacity-50"
            >
              Connect
            </button>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear chat messages?')) {
                onClearChat();
                onClose();
              }
            }}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={13} />
            <span>Clear conversation</span>
          </button>
        </div>
      </div>
    </div>
  );
};
