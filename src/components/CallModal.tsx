import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  Monitor,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CallState } from '../types/chat';

interface CallModalProps {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAnswer: () => void;
  onReject: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleMinimize: () => void;
  onTalkingLevel?: (level: number) => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  callState,
  localStream,
  remoteStream,
  onAnswer,
  onReject,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleMinimize,
  onTalkingLevel,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [audioMeter, setAudioMeter] = useState<number[]>([20, 40, 60, 40, 20]);

  // Connect local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState.isMinimized]);

  // Connect remote video and audio stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }

    // Audio meter analysis on remote stream for visualizer & mascot lip-sync
    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;
        const source = audioCtx.createMediaStreamSource(remoteStream);
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(buffer);
          let sum = 0;
          const bars: number[] = [];
          for (let i = 0; i < 5; i++) {
            const val = buffer[i * 2] || 0;
            sum += val;
            bars.push(Math.max(15, Math.min(100, (val / 255) * 100)));
          }
          setAudioMeter(bars);
          const level = sum / (buffer.length * 100);
          if (onTalkingLevel) onTalkingLevel(Math.min(1, level * 1.5));
          animFrameRef.current = requestAnimationFrame(update);
        };
        animFrameRef.current = requestAnimationFrame(update);
      } catch {
        // audio context failed
      }
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (onTalkingLevel) onTalkingLevel(0);
    };
  }, [remoteStream, onTalkingLevel]);

  if (!callState.isActive && callState.mode !== 'incoming') {
    return null;
  }

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. INCOMING CALL MODAL
  if (callState.mode === 'incoming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-pop-in">
        <div className="w-full max-w-sm bg-[#160f2e] border border-purple-500/30 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
          {/* Avatar Ring */}
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 p-1 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-bounce">
              <span className="text-3xl font-extrabold text-white">
                {callState.remotePeerName.slice(0, 2).toUpperCase() || 'FR'}
              </span>
            </div>
            <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-white shadow-md">
              {callState.type === 'video' ? <Video size={16} /> : <Phone size={16} />}
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-1">
            {callState.remotePeerName || 'Friend'}
          </h3>
          <p className="text-sm text-purple-300/80 mb-6 font-medium">
            Incoming {callState.type === 'video' ? 'Video Call 📹' : 'Voice Call 📞'}...
          </p>

          <div className="flex items-center gap-6 w-full justify-center">
            {/* Decline */}
            <button
              onClick={onReject}
              className="flex-1 max-w-[120px] py-3.5 bg-rose-600/80 hover:bg-rose-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
            >
              <PhoneOff size={18} />
              <span>Decline</span>
            </button>

            {/* Accept */}
            <button
              onClick={onAnswer}
              className="flex-1 max-w-[120px] py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
            >
              <Phone size={18} />
              <span>Answer</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. MINIMIZED PICTURE-IN-PICTURE (PIP) FLOATING WIDGET
  if (callState.isMinimized) {
    return (
      <div className="fixed bottom-24 right-5 z-50 bg-[#160f2e]/95 border border-purple-500/40 rounded-2xl shadow-2xl p-3 flex items-center gap-3 backdrop-blur-lg animate-pop-in">
        {callState.type === 'video' ? (
          <div className="w-16 h-12 bg-black/60 rounded-lg overflow-hidden relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300">
            <Phone size={18} />
          </div>
        )}

        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>{callState.remotePeerName}</span>
            <span className="text-[10px] text-emerald-400 font-mono">
              ({formatDuration(callState.duration)})
            </span>
          </div>
          <div className="text-[10px] text-purple-300/70">
            {callState.type === 'video' ? 'Video Call' : 'Audio Call'}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="p-1.5 hover:bg-white/10 text-white rounded-lg transition-colors"
            title="Expand Call"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={onEndCall}
            className="p-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg transition-colors"
            title="End Call"
          >
            <PhoneOff size={16} />
          </button>
        </div>
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    );
  }

  // 3. FULL CALL SCREEN (AUDIO OR VIDEO)
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0817] text-white">
      {/* Hidden audio element for WebRTC audio playback */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Top Header */}
      <div className="flex items-center justify-between p-4 md:px-8 border-b border-white/10 bg-black/30 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h2 className="text-base font-bold text-white">
              {callState.remotePeerName || 'Friend'}
            </h2>
            <p className="text-xs text-purple-300/80 font-mono">
              {callState.mode === 'outgoing'
                ? 'Calling...'
                : `${callState.type === 'video' ? '📹 HD Video' : '📞 Voice'} · ${formatDuration(callState.duration)}`}
            </p>
          </div>
        </div>

        {/* Minimize Button */}
        <button
          onClick={onToggleMinimize}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors text-purple-200"
          title="Minimize call to chat"
        >
          <Minimize2 size={20} />
        </button>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#140f2b] to-[#0a0717]">
        {callState.type === 'video' ? (
          // VIDEO CALL VIEW
          <div className="w-full h-full relative flex items-center justify-center">
            {/* Remote Video (Full Screen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain bg-black"
            />

            {/* Waiting for remote video indicator if not connected yet */}
            {callState.mode === 'outgoing' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-24 h-24 rounded-full bg-purple-600/30 border-2 border-purple-400 flex items-center justify-center animate-pulse mb-3">
                  <Video size={36} className="text-purple-300" />
                </div>
                <div className="text-lg font-bold text-white">Ringing {callState.remotePeerName}...</div>
                <div className="text-xs text-purple-300/70 mt-1">Waiting for friend to answer</div>
              </div>
            )}

            {/* Local Video Thumbnail (PiP) */}
            <div className="absolute top-4 right-4 w-32 sm:w-44 aspect-video rounded-2xl overflow-hidden border-2 border-purple-500/50 shadow-2xl bg-black/80 z-20">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${callState.isCameraOff ? 'hidden' : ''}`}
              />
              {callState.isCameraOff && (
                <div className="w-full h-full flex flex-col items-center justify-center text-purple-300/70 text-xs">
                  <VideoOff size={20} className="mb-1" />
                  <span>Camera Off</span>
                </div>
              )}
              <div className="absolute bottom-1 left-2 text-[10px] font-bold text-white/90 drop-shadow">
                You
              </div>
            </div>
          </div>
        ) : (
          // AUDIO CALL VIEW
          <div className="flex flex-col items-center justify-center text-center p-6 max-w-md">
            {/* Animated Audio Rings */}
            <div className="relative mb-8">
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
                <span className="text-5xl font-black text-white">
                  {callState.remotePeerName.slice(0, 2).toUpperCase() || 'FR'}
                </span>
              </div>

              {/* Pulsing rings around avatar */}
              <div className="absolute -inset-3 rounded-full border border-purple-400/40 animate-ping opacity-30" />
              <div className="absolute -inset-6 rounded-full border border-purple-500/20 animate-pulse" />
            </div>

            <h3 className="text-2xl font-black text-white mb-2">
              {callState.remotePeerName}
            </h3>
            <p className="text-sm text-purple-300/80 font-mono mb-6">
              {callState.mode === 'outgoing' ? 'Connecting voice call...' : `In Call · ${formatDuration(callState.duration)}`}
            </p>

            {/* Live Audio Waves */}
            <div className="flex items-center gap-2 h-12 px-6 py-2 bg-white/5 rounded-full border border-white/10">
              {audioMeter.map((val, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-gradient-to-t from-emerald-500 to-teal-300 transition-all duration-100"
                  style={{ height: `${val}%` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Call Controls Dock */}
      <div className="p-5 md:py-6 bg-black/40 backdrop-blur-xl border-t border-white/10 flex items-center justify-center gap-4 sm:gap-6 z-20">
        {/* Toggle Mute */}
        <button
          onClick={onToggleMute}
          className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 ${
            callState.isMuted
              ? 'bg-rose-600/80 text-white shadow-rose-600/20'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
          title={callState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {callState.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {/* Toggle Camera (if video call) */}
        {callState.type === 'video' && (
          <button
            onClick={onToggleCamera}
            className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 ${
              callState.isCameraOff
                ? 'bg-rose-600/80 text-white shadow-rose-600/20'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={callState.isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {callState.isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        )}

        {/* Toggle Screen Sharing (if video call) */}
        {callState.type === 'video' && (
          <button
            onClick={onToggleScreenShare}
            className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 ${
              callState.isScreenSharing
                ? 'bg-purple-600 text-white shadow-purple-600/30'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={callState.isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
          >
            <Monitor size={22} />
          </button>
        )}

        {/* Hang Up Button */}
        <button
          onClick={onEndCall}
          className="px-6 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold flex items-center gap-2.5 shadow-xl shadow-rose-600/40 active:scale-95 transition-all"
          title="End Call"
        >
          <PhoneOff size={22} />
          <span className="hidden sm:inline">End Call</span>
        </button>
      </div>
    </div>
  );
};
