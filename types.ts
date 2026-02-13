
export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Attachment {
  type: 'image' | 'file';
  url: string;
  name?: string;
  mimeType: string;
  data?: string; // base64
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: string;
  attachments?: Attachment[];
  isStreaming?: boolean;
  isLive?: boolean;
}

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  isLiveMode: boolean;
}
