import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FastForward } from 'lucide-react';

interface VoiceNotePlayerProps {
  audioUrl: string;
  duration?: number;
  isYou: boolean;
  onTalkingLevel?: (level: number) => void;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  audioUrl,
  duration = 0,
  isYou,
  onTalkingLevel,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onTalkingLevel) onTalkingLevel(0);
    };

    return () => {
      audio.pause();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Simulate waveform audio pulse for mascot when playing
  useEffect(() => {
    if (isPlaying && onTalkingLevel) {
      const loop = () => {
        const pulse = 0.3 + Math.sin(Date.now() / 80) * 0.4 + Math.random() * 0.3;
        onTalkingLevel(Math.max(0, Math.min(1, pulse)));
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (onTalkingLevel) onTalkingLevel(0);
    }
  }, [isPlaying, onTalkingLevel]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (fraction: number) => {
    if (!audioRef.current) return;
    const seekTime = fraction * (totalDuration || audioRef.current.duration || 1);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds: (1 | 1.5 | 2)[] = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    setPlaybackRate(speeds[nextIdx]);
  };

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
  // Generate pseudo waveform bars
  const barHeights = [28, 45, 75, 55, 90, 60, 40, 85, 100, 70, 50, 65, 80, 45, 30, 60, 95, 75, 50, 35, 65, 85, 40, 25];

  return (
    <div className="flex items-center gap-2.5 py-1 px-1 min-w-[210px] sm:min-w-[250px]">
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
          isYou
            ? 'bg-white/20 hover:bg-white/30 text-white shadow-sm'
            : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Waveform Visualization */}
      <div
        className="flex-1 flex flex-col justify-center cursor-pointer py-1"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          handleSeek(frac);
        }}
      >
        <div className="h-7 flex items-center gap-[3px] w-full">
          {barHeights.map((h, i) => {
            const barFraction = i / barHeights.length;
            const isPlayed = barFraction <= progress;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-all duration-150"
                style={{
                  height: `${h}%`,
                  backgroundColor: isPlayed
                    ? isYou
                      ? '#ffffff'
                      : '#34d399'
                    : isYou
                    ? 'rgba(255, 255, 255, 0.35)'
                    : 'rgba(52, 211, 153, 0.25)',
                }}
              />
            );
          })}
        </div>

        {/* Time Stamp */}
        <div className="flex justify-between items-center text-[10px] font-semibold mt-1 opacity-75">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Speed Multiplier Pill */}
      <button
        onClick={cycleSpeed}
        className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 transition-all ${
          isYou
            ? 'bg-white/15 hover:bg-white/25 text-white'
            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300'
        }`}
        title="Change playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
};
