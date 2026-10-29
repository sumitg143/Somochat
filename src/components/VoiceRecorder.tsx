import React, { useState, useEffect, useRef } from 'react';
import { Mic, Trash2, Send, Disc } from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface VoiceRecorderProps {
  onSendVoice: (audioUrl: string, durationSecs: number) => void;
  onCancel: () => void;
  onTalkingLevel?: (level: number) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSendVoice,
  onCancel,
  onTalkingLevel,
}) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioWaves, setAudioWaves] = useState<number[]>([15, 25, 40, 20, 30]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      sound.playRecordStart();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Audio analysis for real-time waveform & mascot lip sync
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);

        let sum = 0;
        const waves: number[] = [];
        const step = Math.floor(buffer.length / 8) || 1;
        for (let i = 0; i < 8; i++) {
          const val = buffer[i * step] || 0;
          sum += val;
          waves.push(Math.max(12, Math.min(100, Math.floor((val / 255) * 100))));
        }
        setAudioWaves(waves);

        const averageVolume = sum / (buffer.length * 128);
        if (onTalkingLevel) {
          onTalkingLevel(Math.min(1, averageVolume * 1.5));
        }

        animFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      animFrameRef.current = requestAnimationFrame(updateWaveform);

      // MediaRecorder initialization
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);

      // Start elapsed timer
      let secs = 0;
      timerRef.current = window.setInterval(() => {
        secs += 1;
        setRecordingTime(secs);
      }, 1000);
    } catch {
      alert('Microphone access is required to record voice notes.');
      onCancel();
    }
  };

  const cleanup = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (onTalkingLevel) onTalkingLevel(0);
  };

  const handleSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.onstop = () => {
      const mime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mime });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        onSendVoice(base64Url, Math.max(1, recordingTime));
      };
      reader.readAsDataURL(blob);
      cleanup();
    };

    recorder.stop();
  };

  const handleCancelClick = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    onCancel();
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="flex items-center gap-3 w-full bg-purple-950/40 border border-purple-500/30 rounded-2xl px-4 py-2.5 backdrop-blur-md animate-pop-in">
      {/* Blinking Recording Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-mono font-bold text-red-300">
          {formatTimer(recordingTime)}
        </span>
      </div>

      {/* Live Audio Visualizer Waves */}
      <div className="flex-1 flex items-center justify-center gap-1.5 h-7 px-2">
        {audioWaves.map((h, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-pink-400 transition-all duration-75"
            style={{ height: `${Math.max(15, h)}%` }}
          />
        ))}
      </div>

      {/* Discard & Send Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleCancelClick}
          className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-colors"
          title="Cancel recording"
        >
          <Trash2 size={18} />
        </button>

        <button
          onClick={handleSend}
          className="px-3.5 py-1.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-pink-500/20 active:scale-95 transition-all"
          title="Send voice note"
        >
          <Send size={14} />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
};
