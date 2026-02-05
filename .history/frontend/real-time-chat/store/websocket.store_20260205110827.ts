import { create } from "zustand";

// Types basés sur le protocole WebSocket du backend
export interface WsMessage {
  id: string;
  channel_id: string;
  author_id: string;
  username?: string; // On l'ajoute côté client
  content: string;
  created_at: string;
}

// CLIENT → SERVER events
type ClientEvent =
  | { type: "MessageSend"; payload: { channel_id: string; content: string } }
  | { type: "JoinChannel"; payload: { channel_id: string } }
  | { type: "LeaveChannel"; payload: { channel_id: string } }
  | { type: "TypingStart"; payload: { channel_id: string } }
  | { type: "TypingStop"; payload: { channel_id: string } }
  | { type: "Ping" };

// SERVER → CLIENT events
type ServerEvent =
  | { type: "MessageNew"; payload: { id: string; channel_id: string; author_id: string; content: string; created_at: string } }
  | { type: "UserJoined"; payload: { user_id: string; channel_id: string } }
  | { type: "UserLeft"; payload: { user_id: string; channel_id: string } }
  | { type: "TypingStart"; payload: { user_id: string; channel_id: string } }
  | { type: "TypingStop"; payload: { user_id: string; channel_id: string } }
  | { type: "Pong" }
  | { type: "UserOnline"; payload: { user_id: string } }
  | { type: "UserOffline"; payload: { user_id: string } };

type WebSocketState = {
  socket: WebSocket | null;
  isConnected: boolean;
  messages: Map<string, WsMessage[]>; // channel_id -> messages
  currentChannelId: string | null;
  typingUsers: Map<string, Set<string>>; // channel_id -> user_ids
  onlineUsers: Set<string>;
  error: string | null;

  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (channelId: string, content: string) => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;
  getMessages: (channelId: string) => WsMessage[];
  clearMessages: (channelId: string) => void;
  setCurrentChannel: (channelId: string | null) => void;
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  messages: new Map(),
  currentChannelId: null,
  typingUsers: new Map(),
  onlineUsers: new Set(),
  error: null,

  connect: (token: string) => {
    const existingSocket = get().socket;
    if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
      set({ isConnected: true, error: null });

      // Rejoin current channel if any
      const currentChannel = get().currentChannelId;
      if (currentChannel) {
        get().joinChannel(currentChannel);
      }

      // Start ping interval
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "Ping" }));
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const serverEvent = JSON.parse(event.data) as ServerEvent;
        handleServerEvent(serverEvent, set);
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    socket.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      set({ error: "Erreur de connexion WebSocket" });
    };

    socket.onclose = () => {
      console.log("🔌 WebSocket disconnected");
      set({ socket: null, isConnected: false });

      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        const state = get();
        if (!state.isConnected && token) {
          console.log("🔄 Attempting to reconnect...");
          state.connect(token);
        }
      }, 3000);
    };

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false });
    }
  },

  sendMessage: (channelId: string, content: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "MessageSend",
        payload: { channel_id: channelId, content },
      };
      socket.send(JSON.stringify(event));
    }
  },

  joinChannel: (channelId: string) => {
    const { socket, currentChannelId } = get();
    
    // Leave previous channel
    if (currentChannelId && currentChannelId !== channelId) {
      get().leaveChannel(currentChannelId);
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "JoinChannel",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
      set({ currentChannelId: channelId });
    }
  },

  leaveChannel: (channelId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "LeaveChannel",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  startTyping: (channelId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "TypingStart",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  stopTyping: (channelId: string) => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "TypingStop",
        payload: { channel_id: channelId },
      };
      socket.send(JSON.stringify(event));
    }
  },

  getMessages: (channelId: string) => {
    const { messages } = get();
    return messages.get(channelId) || [];
  },

  clearMessages: (channelId: string) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.delete(channelId);
      return { messages: newMessages };
    });
  },

  setCurrentChannel: (channelId: string | null) => {
    set({ currentChannelId: channelId });
  },
}));

// Handle incoming server events
function handleServerEvent(
  event: ServerEvent,
  set: (partial: Partial<WebSocketState> | ((state: WebSocketState) => Partial<WebSocketState>)) => void,
) {
  switch (event.type) {
    case "MessageNew": {
      const { id, channel_id, author_id, content, created_at } = event.payload;
      const newMessage: WsMessage = {
        id,
        channel_id,
        author_id,
        content,
        created_at,
      };

      set((state) => {
        const newMessages = new Map(state.messages);
        const channelMessages = newMessages.get(channel_id) || [];
        
        // Avoid duplicates
        if (!channelMessages.some((m) => m.id === id)) {
          newMessages.set(channel_id, [...channelMessages, newMessage]);
        }
        
        return { messages: newMessages };
      });
      break;
    }

    case "UserJoined": {
      console.log(`User ${event.payload.user_id} joined channel ${event.payload.channel_id}`);
      break;
    }

    case "UserLeft": {
      console.log(`User ${event.payload.user_id} left channel ${event.payload.channel_id}`);
      break;
    }

    case "TypingStart": {
      const { user_id, channel_id } = event.payload;
      set((state) => {
        const newTyping = new Map(state.typingUsers);
        const channelTyping = new Set(newTyping.get(channel_id) || []);
        channelTyping.add(user_id);
        newTyping.set(channel_id, channelTyping);
        return { typingUsers: newTyping };
      });
      break;
    }

    case "TypingStop": {
      const { user_id, channel_id } = event.payload;
      set((state) => {
        const newTyping = new Map(state.typingUsers);
        const channelTyping = new Set(newTyping.get(channel_id) || []);
        channelTyping.delete(user_id);
        newTyping.set(channel_id, channelTyping);
        return { typingUsers: newTyping };
      });
      break;
    }

    case "UserOnline": {
      set((state) => {
        const newOnline = new Set(state.onlineUsers);
        newOnline.add(event.payload.user_id);
        return { onlineUsers: newOnline };
      });
      break;
    }

    case "UserOffline": {
      set((state) => {
        const newOnline = new Set(state.onlineUsers);
        newOnline.delete(event.payload.user_id);
        return { onlineUsers: newOnline };
      });
      break;
    }

    case "Pong": {
      // Heartbeat received
      break;
    }
  }
}
