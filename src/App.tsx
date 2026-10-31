import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import {
  Send,
  Mic,
  Phone,
  Video,
  Users,
  Smile,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Volume2,
  ImagePlus,
  Camera,
  CirclePlus,
  X,
} from 'lucide-react';
import {
  ChatMessage,
  CallState,
  PeerPacket,
  MascotEmotion,
} from './types/chat';
import { sound } from './utils/soundEffects';
import { heartMotion } from './utils/heartMotion';
import { EmojiMascot3D } from './components/EmojiMascot3D';
import { MessageItem } from './components/MessageItem';
import { VoiceRecorder } from './components/VoiceRecorder';
import { CallModal } from './components/CallModal';
import { LinkPeerModal } from './components/LinkPeerModal';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export default function App() {
  // User & Profile State
  const [username, setUsername] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [friendName, setFriendName] = useState<string>('Friend');
  const [isLinked, setIsLinked] = useState<boolean>(false);

  // Chat & Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isFriendTyping, setIsFriendTyping] = useState<boolean>(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [isGroupPanelOpen, setIsGroupPanelOpen] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [statusText, setStatusText] = useState<string>('Available to chat');
  const [isStatusPanelOpen, setIsStatusPanelOpen] = useState<boolean>(false);

  // 3D Mascot State
  const [mascotEmotion, setMascotEmotion] = useState<MascotEmotion>('happy');
  const [talkingLevel, setTalkingLevel] = useState<number>(0);
  const [mascotSpeech, setMascotSpeech] = useState<string>('Namaste! 👋');
  const [showMascotStage, setShowMascotStage] = useState<boolean>(true);

  // Call State
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    type: null,
    mode: null,
    remotePeerId: '',
    remotePeerName: 'Friend',
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    duration: 0,
    isMinimized: false,
  });

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Modals & UI
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Refs for WebRTC & Audio
  const peerRef = useRef<Peer | null>(null);
  const activeConnRef = useRef<DataConnection | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const localTabId = useRef<string>(Math.random().toString(36).slice(2, 9));

  // Initialize BroadcastChannel for same-device multi-tab testing
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('somochat_channel');
      broadcastChannelRef.current = bc;

      bc.onmessage = (e) => {
        const data = e.data;
        if (!data || data.fromTab === localTabId.current) return;

        if (data.type === 'chat_message') {
          handleIncomingMessage(data.message);
        } else if (data.type === 'reaction') {
          handleIncomingReaction(data.messageId, data.emoji, data.senderName);
        } else if (data.type === 'typing') {
          handleIncomingTyping();
        }
      };

      return () => {
        bc.close();
      };
    }
  }, [username]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isFriendTyping]);

  // Check URL parameters for direct connect link (?connect=PEER_ID)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectTo = params.get('connect');
    if (connectTo && peerRef.current && peerRef.current.open) {
      connectToRemotePeer(connectTo);
    }
  }, [isLoggedIn, myPeerId]);

  // Initialize PeerJS
  const initPeer = (name: string) => {
    try {
      const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      const randomSuffix = Math.random().toString(36).substring(2, 6);
      const customId = `somo-${sanitized || 'user'}-${randomSuffix}`;

      const peer = new Peer(customId, {
        config: { iceServers: ICE_SERVERS },
        debug: 1,
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        setMyPeerId(id);
        const params = new URLSearchParams(window.location.search);
        const connectTo = params.get('connect');
        if (connectTo && connectTo !== id) {
          connectToRemotePeer(connectTo);
        }
      });

      // Handle incoming data connection
      peer.on('connection', (conn) => {
        setupDataConnection(conn);
      });

      // Handle incoming media call (Audio or Video)
      peer.on('call', (mediaCall) => {
        handleIncomingCall(mediaCall);
      });

      peer.on('error', (err) => {
        console.warn('Peer error:', err);
      });
    } catch (e) {
      console.error('Failed to initialize peer:', e);
    }
  };

  // Setup Data Connection Listeners
  const setupDataConnection = (conn: DataConnection) => {
    activeConnRef.current = conn;

    conn.on('open', () => {
      setIsLinked(true);
      sound.playCallConnected();
      setMascotEmotion('love');
      setMascotSpeech('Dost connect ho gaya! 🎉');

      // Send greeting handshake
      conn.send({
        type: 'profile_sync',
        senderName: username,
      } as PeerPacket);
    });

    conn.on('data', (raw: unknown) => {
      const packet = raw as PeerPacket;

      if (packet.type === 'profile_sync' && packet.senderName) {
        setFriendName(packet.senderName);
        setMascotSpeech(`${packet.senderName} online hai! 👋`);
      } else if (packet.type === 'text' || packet.type === 'voice' || packet.type === 'image') {
        const newMsg: ChatMessage = {
          id: packet.id || Math.random().toString(36).slice(2),
          senderId: packet.senderId || 'peer',
          senderName: packet.senderName || friendName,
          content: packet.content || '',
          timestamp: packet.timestamp || Date.now(),
          isYou: false,
          type: packet.type,
          imageUrl: packet.imageUrl,
          audioUrl: packet.audioUrl,
          audioDuration: packet.audioDuration,
          reactions: {},
          status: 'delivered',
        };
        handleIncomingMessage(newMsg);

        // Send delivery ack
        conn.send({
          type: 'ack',
          id: packet.id,
        } as PeerPacket);
      } else if (packet.type === 'reaction') {
        handleIncomingReaction(
          packet.targetMessageId || '',
          packet.emoji || '❤️',
          packet.senderName || friendName
        );
      } else if (packet.type === 'typing') {
        handleIncomingTyping();
      } else if (packet.type === 'ack' && packet.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === packet.id ? { ...m, status: 'delivered' } : m))
        );
      } else if (packet.type === 'call_signal') {
        if (packet.signalAction === 'reject') {
          sound.playCallEnd();
          endCurrentCall();
        }
      }
    });

    conn.on('close', () => {
      setIsLinked(false);
      setMascotSpeech('Dost disconnect ho gaya');
    });
  };

  // Connect to Remote Peer by ID
  const connectToRemotePeer = (remoteId: string) => {
    if (!peerRef.current || !remoteId || remoteId === myPeerId) return;

    try {
      const conn = peerRef.current.connect(remoteId, { reliable: true });
      setupDataConnection(conn);
    } catch (e) {
      console.error('Error connecting to peer:', e);
    }
  };

  // Handle Incoming Message
  const handleIncomingMessage = (newMsg: ChatMessage) => {
    sound.playReceived();
    setIsFriendTyping(false);

    // Update 3D Mascot reactions based on text
    const text = newMsg.content.toLowerCase();
    if (text.includes('love') || text.includes('dil') || text.includes('❤️') || text.includes('pyar')) {
      setMascotEmotion('love');
      setMascotSpeech('Awww! Kitna pyara! ❤️');
      heartMotion.triggerHeartMotion();
    } else if (text.includes('haha') || text.includes('lol') || text.includes('😂')) {
      setMascotEmotion('laugh');
      setMascotSpeech('Hahaha mast joke tha! 😂');
    } else if (text.includes('wow') || text.includes('kya baat') || text.includes('omg')) {
      setMascotEmotion('shock');
      setMascotSpeech('Sach mein?! 😮');
    } else {
      setMascotEmotion('happy');
      setMascotSpeech(`${newMsg.senderName} ne message bheja! 💬`);
    }

    setMessages((prev) => [...prev, newMsg]);
  };

  // Handle Incoming Reaction
  const handleIncomingReaction = (messageId: string, emoji: string, sender: string) => {
    if (emoji === '❤️') {
      heartMotion.triggerHeartMotion();
      setMascotEmotion('love');
      setMascotSpeech(`${sender} ne Heart React kiya! ❤️`);
    } else {
      heartMotion.triggerEmojiMotion(emoji);
      setMascotEmotion('laugh');
      setMascotSpeech(`${sender} ne ${emoji} react kiya!`);
    }

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentUsers = m.reactions[emoji] || [];
        if (currentUsers.includes(sender)) return m;
        return {
          ...m,
          reactions: {
            ...m.reactions,
            [emoji]: [...currentUsers, sender],
          },
        };
      })
    );
  };

  // Handle Incoming Typing Indicator
  const handleIncomingTyping = () => {
    setIsFriendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsFriendTyping(false);
    }, 2500);
  };

  // Send Text Message
  const handleSendMessage = () => {
    const text = inputText.trim();
    if (!text) return;

    const newMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2, 9),
      senderId: myPeerId || 'you',
      senderName: username,
      content: text,
      timestamp: Date.now(),
      isYou: true,
      type: 'text',
      reactions: {},
      status: isLinked ? 'sent' : 'queued',
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');
    sound.playSent();

    // Trigger mascot animation
    if (text.includes('❤️') || text.toLowerCase().includes('love')) {
      setMascotEmotion('love');
      setMascotSpeech('Pyar bhara message! ❤️');
      heartMotion.triggerHeartMotion();
    } else {
      setMascotEmotion('happy');
      setMascotSpeech('Message bhej diya! ✨');
    }

    // Send over WebRTC Data Connection
    if (activeConnRef.current && activeConnRef.current.open) {
      activeConnRef.current.send({
        type: 'text',
        id: newMsg.id,
        senderId: myPeerId,
        senderName: username,
        content: newMsg.content,
        timestamp: newMsg.timestamp,
      } as PeerPacket);
    }

    // Broadcast for multi-tab testing
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'chat_message',
        fromTab: localTabId.current,
        message: { ...newMsg, isYou: false },
      });
    }
  };

  // Send an image from the gallery or camera as a chat message.
  const handleImageSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = String(reader.result);
      const newMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2, 9),
        senderId: myPeerId || 'you', senderName: username, content: file.name,
        timestamp: Date.now(), isYou: true, type: 'image', imageUrl,
        reactions: {}, status: isLinked ? 'sent' : 'queued',
      };
      setMessages((prev) => [...prev, newMsg]);
      setMascotEmotion('party');
      setMascotSpeech('Photo share ho gayi! 📸');
      sound.playSent();
      if (activeConnRef.current?.open) activeConnRef.current.send({ type: 'image', id: newMsg.id, senderId: myPeerId, senderName: username, content: file.name, imageUrl, timestamp: newMsg.timestamp } as PeerPacket);
    };
    reader.readAsDataURL(file);
  };

  const createGroup = () => {
    const name = groupName.trim() || 'New SomoChat group';
    setGroupName(name);
    setGroupMembers((prev) => (prev.length ? prev : [username, friendName]));
    setIsGroupPanelOpen(false);
    setMascotSpeech(`${name} group ready hai! 👥`);
  };

  // Send Voice Note
  const handleSendVoiceNote = (audioUrl: string, durationSecs: number) => {
    const newMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2, 9),
      senderId: myPeerId || 'you',
      senderName: username,
      content: '🎙️ Voice note',
      timestamp: Date.now(),
      isYou: true,
      type: 'voice',
      audioUrl: audioUrl,
      audioDuration: durationSecs,
      reactions: {},
      status: isLinked ? 'sent' : 'queued',
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsRecordingVoice(false);
    sound.playSent();
    setMascotEmotion('party');
    setMascotSpeech('Voice note bhej diya! 🎙️');

    if (activeConnRef.current && activeConnRef.current.open) {
      activeConnRef.current.send({
        type: 'voice',
        id: newMsg.id,
        senderId: myPeerId,
        senderName: username,
        content: newMsg.content,
        audioUrl: newMsg.audioUrl,
        audioDuration: newMsg.audioDuration,
        timestamp: newMsg.timestamp,
      } as PeerPacket);
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'chat_message',
        fromTab: localTabId.current,
        message: { ...newMsg, isYou: false },
      });
    }
  };

  // Handle Local React on a Message
  const handleReactToMessage = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const currentUsers = m.reactions[emoji] || [];
        if (currentUsers.includes(username)) return m;
        return {
          ...m,
          reactions: {
            ...m.reactions,
            [emoji]: [...currentUsers, username],
          },
        };
      })
    );

    if (emoji === '❤️') {
      setMascotEmotion('love');
      setMascotSpeech('Awww dil khush ho gaya! ❤️');
    }

    // Send reaction to friend
    if (activeConnRef.current && activeConnRef.current.open) {
      activeConnRef.current.send({
        type: 'reaction',
        targetMessageId: messageId,
        emoji,
        senderName: username,
      } as PeerPacket);
    }

    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'reaction',
        fromTab: localTabId.current,
        messageId,
        emoji,
        senderName: username,
      });
    }
  };

  // Handle Input typing change to broadcast typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (activeConnRef.current && activeConnRef.current.open) {
      activeConnRef.current.send({ type: 'typing' } as PeerPacket);
    }
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({
        type: 'typing',
        fromTab: localTabId.current,
      });
    }
  };

  // ---------------- CALLING LOGIC (AUDIO & VIDEO) ----------------

  const startCall = async (type: 'audio' | 'video') => {
    if (!peerRef.current) {
      alert('Connecting to peer server, please wait a moment.');
      return;
    }

    const targetPeerId = activeConnRef.current?.peer;
    if (!targetPeerId) {
      setIsLinkModalOpen(true);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      sound.startRingtone(true);

      setCallState({
        isActive: true,
        type,
        mode: 'outgoing',
        remotePeerId: targetPeerId,
        remotePeerName: friendName,
        isMuted: false,
        isCameraOff: false,
        isScreenSharing: false,
        duration: 0,
        isMinimized: false,
      });

      const call = peerRef.current.call(targetPeerId, stream, {
        metadata: { callType: type, callerName: username },
      });

      activeCallRef.current = call;

      call.on('stream', (remote) => {
        sound.playCallConnected();
        setRemoteStream(remote);
        setCallState((prev) => ({ ...prev, mode: 'connected' }));
        startCallTimer();
        setMascotSpeech('Call connect ho gayi! 📞');
      });

      call.on('close', () => {
        endCurrentCall();
      });

      call.on('error', () => {
        endCurrentCall();
      });
    } catch {
      alert(`Could not access ${type === 'video' ? 'Camera/Mic' : 'Microphone'}. Please allow permissions.`);
      endCurrentCall();
    }
  };

  const handleIncomingCall = (mediaCall: MediaConnection) => {
    const meta = mediaCall.metadata || {};
    const type: 'audio' | 'video' = meta.callType === 'video' ? 'video' : 'audio';
    const caller: string = meta.callerName || 'Friend';

    activeCallRef.current = mediaCall;
    sound.startRingtone(false);

    setCallState({
      isActive: true,
      type,
      mode: 'incoming',
      remotePeerId: mediaCall.peer,
      remotePeerName: caller,
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
      duration: 0,
      isMinimized: false,
    });
  };

  const answerIncomingCall = async () => {
    sound.stopRingtone();
    const call = activeCallRef.current;
    if (!call) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callState.type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      call.answer(stream);
      sound.playCallConnected();

      call.on('stream', (remote) => {
        setRemoteStream(remote);
        setCallState((prev) => ({ ...prev, mode: 'connected' }));
        startCallTimer();
        setMascotSpeech('Call chalu ho gayi! 🎙️');
      });

      call.on('close', () => {
        endCurrentCall();
      });
    } catch {
      alert('Camera/Microphone permission denied.');
      rejectIncomingCall();
    }
  };

  const rejectIncomingCall = () => {
    sound.stopRingtone();
    if (activeCallRef.current) {
      activeCallRef.current.close();
      activeCallRef.current = null;
    }
    if (activeConnRef.current && activeConnRef.current.open) {
      activeConnRef.current.send({
        type: 'call_signal',
        signalAction: 'reject',
      } as PeerPacket);
    }
    endCurrentCall();
  };

  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = window.setInterval(() => {
      setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  };

  const endCurrentCall = () => {
    sound.playCallEnd();
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (activeCallRef.current) {
      try {
        activeCallRef.current.close();
      } catch {
        // ignore
      }
      activeCallRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setTalkingLevel(0);
    setCallState({
      isActive: false,
      type: null,
      mode: null,
      remotePeerId: '',
      remotePeerName: 'Friend',
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
      duration: 0,
      isMinimized: false,
    });
  };

  const toggleMute = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setCallState((prev) => ({ ...prev, isMuted: !audioTrack.enabled }));
    }
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCallState((prev) => ({ ...prev, isCameraOff: !videoTrack.enabled }));
    }
  };

  const toggleScreenShare = async () => {
    if (callState.isScreenSharing) {
      // Revert back to webcam
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (activeCallRef.current && activeCallRef.current.peerConnection) {
          const sender = activeCallRef.current.peerConnection
            .getSenders()
            .find((s) => s.track && s.track.kind === 'video');
          if (sender && stream.getVideoTracks()[0]) {
            sender.replaceTrack(stream.getVideoTracks()[0]);
          }
        }
        setCallState((prev) => ({ ...prev, isScreenSharing: false }));
      } catch {
        // ignore
      }
    } else {
      // Start screen sharing
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        const screenTrack = screenStream.getVideoTracks()[0];

        if (activeCallRef.current && activeCallRef.current.peerConnection) {
          const sender = activeCallRef.current.peerConnection
            .getSenders()
            .find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setCallState((prev) => ({ ...prev, isScreenSharing: true }));
      } catch {
        // user cancelled
      }
    }
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim() || 'Dost';
    setUsername(trimmed);
    setIsLoggedIn(true);
    initPeer(trimmed);

    // Initial greeting
    setTimeout(() => {
      setMessages([
        {
          id: 'welcome-1',
          senderId: 'system',
          senderName: 'SomoChat Bot',
          content: `Namaste ${trimmed}! 🙏 SomoChat 3D mein aapka swagat hai.\n\n✨ Real P2P Chat\n🎙️ Voice Audio Notes & Voice Calling\n📹 HD Video Calling\n❤️ Double-Tap Heart React with floating particle motion!\n🧸 3D Animated Emoji Mascot jo mouse ke saath move karta hai aur bolta hai!`,
          timestamp: Date.now(),
          isYou: false,
          type: 'text',
          reactions: { '❤️': [trimmed], '🎉': ['SomoBot'] },
          status: 'delivered',
        },
      ]);
      heartMotion.triggerHeartMotion();
    }, 400);
  };

  // ---------------- UI RENDERING ----------------

  // 1. WELCOME SCREEN
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,#201445_0%,#0c081c_70%)] text-white">
        <div className="w-full max-w-md bg-[#160f2e]/80 border border-purple-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-2xl text-center animate-pop-in">
          {/* Animated 3D Mascot Preview */}
          <div className="flex justify-center mb-4">
            <EmojiMascot3D
              emotion="happy"
              speechText="Apna naam daalo! 👋"
            />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-300 via-pink-300 to-amber-200 bg-clip-text text-transparent mb-2">
            SomoChat 3D
          </h1>
          <p className="text-sm text-purple-300/80 mb-6 font-medium">
            Real P2P Chat · HD Video Call · Voice Chat · Heart Motion
          </p>

          <form onSubmit={handleStartChat} className="space-y-4">
            <div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Apna username chune (e.g. Amit)"
                maxLength={24}
                className="w-full px-4 py-3.5 bg-black/40 border border-purple-500/30 rounded-2xl text-white placeholder-purple-300/40 text-center font-semibold text-base outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-amber-400 via-pink-500 to-purple-600 hover:from-amber-300 hover:via-pink-400 hover:to-purple-500 text-white font-bold text-base rounded-2xl shadow-lg shadow-pink-600/30 active:scale-95 transition-all cursor-pointer"
            >
              Start Chatting 🚀
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-center gap-4 text-xs text-purple-300/60 font-medium">
            <span>🔒 Direct Encrypted</span>
            <span>·</span>
            <span>📹 HD WebRTC</span>
            <span>·</span>
            <span>❤️ 3D Heart Reactions</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. MAIN CHAT DASHBOARD
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-2 sm:p-4 bg-[radial-gradient(ellipse_at_top,#201445_0%,#0c081c_70%)]">
      {/* Active Video/Audio Call Overlay Modal */}
      <CallModal
        callState={callState}
        localStream={localStream}
        remoteStream={remoteStream}
        onAnswer={answerIncomingCall}
        onReject={rejectIncomingCall}
        onEndCall={endCurrentCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onToggleMinimize={() =>
          setCallState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }))
        }
        onTalkingLevel={setTalkingLevel}
      />

      {/* Link Peer Modal */}
      <LinkPeerModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        myPeerId={myPeerId}
        isLinked={isLinked}
        onConnect={connectToRemotePeer}
        onClearChat={() => setMessages([])}
      />

      {/* Main Glassmorphic Chat Card */}
      <div className="w-full max-w-2xl h-[94vh] sm:h-[88vh] bg-[#160f2e]/80 border border-purple-500/30 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="p-3.5 sm:px-5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            {/* Status dot and name */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center font-black text-white text-sm shadow-md">
                {username.slice(0, 2).toUpperCase()}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#160f2e] ${
                  isLinked ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                title={isLinked ? 'Linked with friend' : 'Waiting for connection'}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-sm sm:text-base text-white">
                  {username}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  {isLinked ? `Linked to ${friendName}` : 'P2P Ready'}
                </span>
              </div>
              <div className="text-[11px] text-purple-300/70 font-mono">
                ID: {myPeerId ? `${myPeerId.slice(0, 14)}...` : 'Connecting...'}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={() => setIsStatusPanelOpen((open) => !open)} className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 border border-amber-300/20 text-[11px] font-bold" title="Update your status">
              <CirclePlus size={15} /> Status
            </button>
            <button onClick={() => setIsGroupPanelOpen((open) => !open)} className="p-2.5 rounded-xl bg-teal-400/10 hover:bg-teal-400/20 text-teal-200 border border-teal-300/20 transition-all" title="Create a group chat">
              <Users size={17} />
            </button>
            {/* Voice Call Button */}
            <button
              onClick={() => startCall('audio')}
              className="p-2.5 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-500/30 transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Voice Call 📞"
            >
              <Phone size={17} />
            </button>

            {/* Video Call Button */}
            <button
              onClick={() => startCall('video')}
              className="p-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-semibold transition-all hover:scale-105 active:scale-95 shadow-md shadow-pink-600/20"
              title="Video Call 📹"
            >
              <Video size={17} />
            </button>

            {/* Link Peer Button */}
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all hover:scale-105 active:scale-95"
              title="Link with friend / Copy ID"
            >
              <Users size={17} />
            </button>

            {/* Toggle Mascot Visibility */}
            <button
              onClick={() => setShowMascotStage(!showMascotStage)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-purple-300 transition-colors"
              title={showMascotStage ? 'Hide 3D Mascot' : 'Show 3D Mascot'}
            >
              {showMascotStage ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
          </div>
        </header>

        {(isGroupPanelOpen || isStatusPanelOpen) && (
          <section className="mx-3 mt-3 p-3 rounded-2xl bg-black/25 border border-white/10 shrink-0 animate-pop-in" aria-label="Chat options">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white">{isGroupPanelOpen ? 'Create a group chat' : 'Your status'}</h3>
              <button onClick={() => { setIsGroupPanelOpen(false); setIsStatusPanelOpen(false); }} className="p-1 rounded-lg text-purple-300 hover:bg-white/10" title="Close options"><X size={14} /></button>
            </div>
            {isGroupPanelOpen ? (
              <div className="flex gap-2">
                <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="min-w-0 flex-1 rounded-xl border border-purple-500/30 bg-black/30 px-3 py-2 text-xs text-white outline-none" />
                <button onClick={createGroup} className="rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white hover:bg-teal-400">Create</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={statusText} onChange={(e) => setStatusText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setIsStatusPanelOpen(false); }} className="min-w-0 flex-1 rounded-xl border border-purple-500/30 bg-black/30 px-3 py-2 text-xs text-white outline-none" aria-label="Status message" />
                <button onClick={() => setIsStatusPanelOpen(false)} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-400">Save</button>
              </div>
            )}
            {groupMembers.length > 0 && <p className="mt-2 text-[10px] text-teal-200/70">{groupName} · {groupMembers.length} members</p>}
          </section>
        )}

        {/* 3D Animated Emoji Mascot Stage */}
        {showMascotStage && (
          <div className="relative py-2 px-4 border-b border-white/10 bg-gradient-to-b from-purple-950/30 to-transparent flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <EmojiMascot3D
                emotion={mascotEmotion}
                talkingLevel={talkingLevel}
                speechText={mascotSpeech}
                onTap={() => {
                  sound.playHeartReact();
                  heartMotion.triggerHeartMotion();
                }}
              />
              <div>
                <div className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                  <span>3D Emoji Companion</span>
                  <Sparkles size={13} className="text-amber-300 animate-spin" />
                </div>
                <div className="text-[11px] text-purple-300/70 max-w-[200px] sm:max-w-xs truncate">
                  {mascotSpeech || 'Pointer ke saath dekhta hai!'}
                </div>
              </div>
            </div>

            {/* Quick Heart React Floating Button */}
            <button
              onClick={() => {
                sound.playHeartReact();
                heartMotion.triggerHeartMotion();
                setMascotEmotion('love');
                setMascotSpeech('Dil se thank you! ❤️');
              }}
              className="px-3 py-1.5 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 hover:text-white rounded-full text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
              title="Trigger Full-Screen Heart React Motion"
            >
              <span>❤️ React Heart</span>
            </button>
          </div>
        )}

        {/* Messages Feed Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col justify-start">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-purple-300/60">
              <div className="w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-2xl mb-3">
                💬
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Conversation khali hai
              </h3>
              <p className="text-xs max-w-xs mb-4">
                Upar Link icon pe click karke friend ko ID bhejo, ya niche message type karo.
              </p>
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="px-4 py-2 bg-purple-600/50 hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-all"
              >
                Link a Friend 🔗
              </button>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                currentUsername={username}
                onReact={handleReactToMessage}
                onTalkingLevel={setTalkingLevel}
              />
            ))
          )}

          {/* Typing Indicator */}
          {isFriendTyping && (
            <div className="flex items-center gap-2 text-xs text-purple-300/80 mb-2 pl-2 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <span>{friendName} type kar raha hai...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input & Recording Bar */}
        <footer className="p-3 sm:p-4 border-t border-white/10 bg-black/30 backdrop-blur-md shrink-0">
          {isRecordingVoice ? (
            <VoiceRecorder
              onSendVoice={handleSendVoiceNote}
              onCancel={() => setIsRecordingVoice(false)}
              onTalkingLevel={setTalkingLevel}
            />
          ) : (
            <div className="flex items-center gap-2">
              <input ref={galleryInputRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleImageSelected} />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleImageSelected} />
              <button onClick={() => galleryInputRef.current?.click()} className="p-3 rounded-2xl bg-teal-400/10 hover:bg-teal-400/20 text-teal-200 border border-teal-300/20 transition-all active:scale-95 shrink-0" title="Send from gallery">
                <ImagePlus size={19} />
              </button>
              <button onClick={() => cameraInputRef.current?.click()} className="p-3 rounded-2xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-200 border border-amber-300/20 transition-all active:scale-95 shrink-0" title="Take a photo">
                <Camera size={19} />
              </button>
              {/* Voice Record Button */}
              <button
                onClick={() => setIsRecordingVoice(true)}
                className="p-3 rounded-2xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-500/30 transition-all hover:scale-105 active:scale-95 shadow-sm shrink-0"
                title="Record Voice Note 🎙️"
              >
                <Mic size={19} />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                placeholder="Message likho... (Double-tap to heart react)"
                className="flex-1 bg-black/40 border border-purple-500/30 focus:border-purple-400 rounded-2xl px-4 py-3 text-sm text-white placeholder-purple-300/40 outline-none transition-all"
              />

              {/* Heart Quick React Button */}
              <button
                onClick={() => {
                  sound.playHeartReact();
                  heartMotion.triggerHeartMotion();
                  setInputText((prev) => prev + ' ❤️');
                }}
                className="p-3 rounded-2xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 hover:text-pink-300 border border-pink-500/30 transition-all active:scale-95 shrink-0"
                title="Heart React ❤️"
              >
                ❤️
              </button>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="p-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white transition-all shadow-md shadow-pink-500/20 active:scale-95 disabled:opacity-40 disabled:scale-100 shrink-0 cursor-pointer"
                title="Send Message"
              >
                <Send size={18} />
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}
