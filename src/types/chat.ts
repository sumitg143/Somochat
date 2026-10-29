export type MessageType = 'text' | 'voice' | 'image' | 'system';

export interface ReactionMap {
  [emoji: string]: string[]; // emoji -> list of usernames
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  isYou: boolean;
  type: MessageType;
  audioUrl?: string; // Data URL for voice notes
  audioDuration?: number; // In seconds
  imageUrl?: string;
  reactions: ReactionMap;
  status: 'queued' | 'sent' | 'delivered' | 'read';
}

export type MascotEmotion =
  | 'idle'
  | 'happy'
  | 'love'
  | 'laugh'
  | 'shock'
  | 'sad'
  | 'angry'
  | 'party'
  | 'cool';

export interface CallState {
  isActive: boolean;
  type: 'audio' | 'video' | null;
  mode: 'incoming' | 'outgoing' | 'connected' | 'ended' | null;
  remotePeerId: string;
  remotePeerName: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  duration: number; // in seconds
  isMinimized: boolean;
}

export interface PeerPacket {
  type:
    | 'text'
    | 'voice'
    | 'image'
    | 'typing'
    | 'reaction'
    | 'ack'
    | 'call_signal'
    | 'profile_sync';
  id?: string;
  senderId?: string;
  senderName?: string;
  content?: string;
  audioUrl?: string;
  audioDuration?: number;
  imageUrl?: string;
  emoji?: string;
  targetMessageId?: string;
  status?: string;
  callType?: 'audio' | 'video';
  signalAction?: 'ring' | 'accept' | 'reject' | 'hangup' | 'busy';
  timestamp?: number;
}
