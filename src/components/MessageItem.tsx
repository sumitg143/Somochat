import React, { useState, useRef } from 'react';
import { Heart, Smile, Check, Clock } from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { heartMotion } from '../utils/heartMotion';

interface MessageItemProps {
  message: ChatMessage;
  currentUsername: string;
  onReact: (messageId: string, emoji: string) => void;
  onTalkingLevel?: (level: number) => void;
}

const QUICK_EMOJIS = ['❤️', '😂', '🔥', '😮', '😢', '👍', '🎉', '🚀'];

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUsername,
  onReact,
  onTalkingLevel,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [justHearted, setJustHearted] = useState(false);
  const lastTapRef = useRef<number>(0);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Handle double-tap or double-click to heart react
  const handleBubbleClick = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected!
      triggerHeartReaction(e);
    }
    lastTapRef.current = now;
  };

  const triggerHeartReaction = (e?: React.MouseEvent) => {
    setJustHearted(true);
    setTimeout(() => setJustHearted(false), 900);

    let clientX = window.innerWidth / 2;
    let clientY = window.innerHeight / 2;

    if (e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }

    // Trigger rich floating heart physics motion & sound!
    heartMotion.triggerHeartMotion(clientX, clientY);
    onReact(message.id, '❤️');
  };

  const handleEmojiSelect = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPicker(false);
    if (emoji === '❤️') {
      triggerHeartReaction(e);
    } else {
      heartMotion.triggerEmojiMotion(emoji, e.clientX, e.clientY);
      onReact(message.id, emoji);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatus = () => {
    if (!message.isYou) return null;
    if (message.status === 'queued') {
      return (
        <span title="Queued" className="inline-flex items-center ml-1 opacity-60">
          <Clock size={12} />
        </span>
      );
    }
    if (message.status === 'sent') {
      return (
        <span title="Sent" className="inline-flex items-center ml-1 opacity-75">
          <Check size={12} />
        </span>
      );
    }
    return (
      <span className="inline-flex ml-1 text-emerald-400 font-bold" title="Delivered">
        ✓✓
      </span>
    );
  };

  const totalReactions = Object.entries(message.reactions || {}).filter(
    ([, users]) => users && users.length > 0
  );

  return (
    <div
      className={`relative group flex flex-col mb-2.5 ${
        message.isYou ? 'items-end' : 'items-start'
      }`}
    >
      {/* Sender Name if friend */}
      {!message.isYou && (
        <span className="text-[11px] font-bold text-teal-300/80 mb-1 ml-2">
          {message.senderName}
        </span>
      )}

      {/* Message Bubble Container */}
      <div className="relative max-w-[85%] sm:max-w-[75%]">
        {/* Animated Heart Overlay on Double Tap */}
        {justHearted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <span className="text-5xl animate-heart-float drop-shadow-lg">❤️</span>
          </div>
        )}

        {/* Bubble */}
        <div
          ref={bubbleRef}
          onClick={handleBubbleClick}
          className={`relative px-3.5 py-2.5 rounded-2xl shadow-md transition-all duration-200 cursor-pointer ${
            message.isYou
              ? 'bg-gradient-to-br from-purple-600 via-pink-600 to-rose-500 text-white rounded-br-sm shadow-pink-600/20'
              : 'bg-[#1b1434] text-[#ede7ff] border border-white/10 rounded-bl-sm hover:border-purple-400/30'
          }`}
        >
          {/* Content: Text or Voice Note */}
          {message.type === 'voice' && message.audioUrl ? (
            <VoiceNotePlayer
              audioUrl={message.audioUrl}
              duration={message.audioDuration}
              isYou={message.isYou}
              onTalkingLevel={onTalkingLevel}
            />
          ) : message.type === 'image' && message.imageUrl ? (
            <div className="space-y-1">
              <img src={message.imageUrl} alt={message.content || 'Shared image'} className="max-h-64 max-w-full rounded-xl object-cover" />
              <p className="text-[11px] opacity-70">{message.content}</p>
            </div>
          ) : (
            <p className="text-sm sm:text-[15px] leading-relaxed break-words whitespace-pre-wrap select-text">
              {message.content}
            </p>
          )}

          {/* Time & Delivery Status */}
          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
              message.isYou ? 'text-white/80' : 'text-purple-300/70'
            }`}
          >
            <span>{formatTime(message.timestamp)}</span>
            {renderStatus()}
          </div>
        </div>

        {/* Existing Reactions Pill Badges */}
        {totalReactions.length > 0 && (
          <div
            className={`flex flex-wrap gap-1 mt-1 z-10 ${
              message.isYou ? 'justify-end mr-1' : 'justify-start ml-1'
            }`}
          >
            {totalReactions.map(([emoji, users]) => {
              const hasReacted = users.includes(currentUsername);
              return (
                <button
                  key={emoji}
                  onClick={(e) => handleEmojiSelect(emoji, e)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold backdrop-blur-md border transition-all active:scale-95 ${
                    hasReacted
                      ? 'bg-purple-600/40 border-purple-400/60 text-white'
                      : 'bg-black/40 border-white/10 text-white/90 hover:border-purple-300/40'
                  }`}
                  title={`${users.join(', ')}`}
                >
                  <span>{emoji}</span>
                  {users.length > 1 && <span className="text-[10px] opacity-80">{users.length}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Floating Action Bar (Heart Button + Emoji Picker Toggle) */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-20 ${
            message.isYou ? '-left-16' : '-right-16'
          }`}
        >
          {/* Quick Heart React Button */}
          <button
            onClick={triggerHeartReaction}
            className="p-1.5 rounded-full bg-black/60 hover:bg-pink-600/80 text-pink-400 hover:text-white border border-white/10 backdrop-blur-md transition-all shadow-md hover:scale-110 active:scale-90"
            title="Heart React ❤️ (Double tap message)"
          >
            <Heart size={14} fill="currentColor" />
          </button>

          {/* More Emojis Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker(!showPicker);
            }}
            className="p-1.5 rounded-full bg-black/60 hover:bg-purple-600/80 text-purple-300 hover:text-white border border-white/10 backdrop-blur-md transition-all shadow-md hover:scale-110 active:scale-90"
            title="Add reaction"
          >
            <Smile size={14} />
          </button>
        </div>

        {/* Emoji Selection Popup */}
        {showPicker && (
          <div
            className={`absolute -top-12 z-40 flex items-center gap-1.5 p-1.5 bg-[#1b1434] border border-purple-500/40 rounded-full shadow-2xl backdrop-blur-xl animate-pop-in ${
              message.isYou ? 'right-0' : 'left-0'
            }`}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => handleEmojiSelect(emoji, e)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 text-lg hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
