import { create } from "zustand";

// Types basés sur le protocole WebSocket du backend
export interface WsMessage {
  id: string;
  channel_id: string;
  author_id: string;
  username?: string;
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
  messages: Record<string, WsMessage[]>; // channel_id -> messages
  currentChannelId: string | null;
  typingUsers: Record<string, string[]>; // channel_id -> user_ids
  onlineUsers: string[];
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
  messages: {},
  currentChannelId: null,
  typingUsers: {},
  onlineUsers: [],
  error: null,

  connect: (token: string) => {
    const existingSocket = get().socket;
    if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const wsUrl = `${WS_URL}?token=${encodeURIComponent(token)}`;
    console.log("🔌 Connecting to WebSocket:", wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
      set({ socket, isConnected: true, error: null });

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
        console.log("📨 WebSocket message received:", event.data);
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

    socket.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", event.code, event.reason);
      set({ socket: null, isConnected: false });

      // Auto-reconnect after 3 seconds if not intentionally closed
      if (event.code !== 1000) {
        setTimeout(() => {
          const state = get();
          if (!state.isConnected && token) {
            console.log("🔄 Attempting to reconnect...");
            state.connect(token);
          }
        }, 3000);
      }
    };

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close(1000, "User disconnected");
      set({ socket: null, isConnected: false });
    }
  },

  sendMessage: (channelId: string, content: string) => {
    const { socket } = get();
    console.log("📤 Sending message:", { channelId, content, socketState: socket?.readyState });
    
    if (socket && socket.readyState === WebSocket.OPEN) {
      const event: ClientEvent = {
        type: "MessageSend",
        payload: { channel_id: channelId, content },
      };
      const json = JSON.stringify(event);
      console.log("📤 Sending WebSocket event:", json);
      socket.send(json);
    } else {
      console.error("❌ Cannot send message: WebSocket not connected");
    }
  },

  joinChannel: (channelId: string) => {
    const { socket, currentChannelId } = get();
    
    console.log("🚪 Joining channel:", channelId);
    
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
    return messages[channelId] || [];
  },

  clearMessages: (channelId: string) => {
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[channelId];
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
  set: (partial: Partial<WebSocketState> | ((state: WebSocketState) => Partial<WebSocketState>)) => void
) {
  console.log("🔔 Handling server event:", event.type, event);
  
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

      console.log("💬 New message received:", newMessage);

      set((state) => {
        const channelMessages = state.messages[channel_id] || [];
        
        // Avoid duplicates
        if (channelMessages.some((m) => m.id === id)) {
          return state;
        }
        
        return {
          messages: {
            ...state.messages,
            [channel_id]: [...channelMessages, newMessage],
          },
        };
      });
      break;
    }

    case "UserJoined": {
      console.log(`👋 User ${event.payload.user_id} joined channel ${event.payload.channel_id}`);
      break;
    }

    case "UserLeft": {
      console.log(`👋 User ${event.payload.user_id} left channel ${event.payload.channel_id}`);
      break;
    }

    case "TypingStart": {
      const { user_id, channel_id } = event.payload;
      set((state) => {
        const channelTyping = state.typingUsers[channel_id] || [];
        if (channelTyping.includes(user_id)) {
          return state;
        }
        return {
          typingUsers: {
            ...state.typingUsers,
            [channel_id]: [...channelTyping, user_id],
          },
        };
      });
      break;
    }

    case "TypingStop": {
      const { user_id, channel_id } = event.payload;
      set((state) => {
        const channelTyping = state.typingUsers[channel_id] || [];
        return {
          typingUsers: {
            ...state.typingUsers,
            [channel_id]: channelTyping.filter((id) => id !== user_id),
          },
        };
      });
      break;
    }

    case "UserOnline": {
      set((state) => {
        if (state.onlineUsers.includes(event.payload.user_id)) {
          return state;
        }
        return {
          onlineUsers: [...state.onlineUsers, event.payload.user_id],
        };
      });
      break;
    }

    case "UserOffline": {
      set((state) => ({
        onlineUsers: state.onlineUsers.filter((id) => id !== event.payload.user_id),
      }));
      break;
    }

    case "Pong": {
      // Heartbeat received
      console.log("💓 Pong received");
      break;
    }
  }
}
