import { create } from "zustand";
import type { WsMessage } from "@/lib/ws/types";

type MessageState = {
  /** channelId → ordered messages */
  messages: Record<string, WsMessage[]>;
  /** channelId → last pagination cursor (for future infinite scroll) */
  cursors: Record<string, string | null>;
  currentChannelId: string | null;

  setMessages(channelId: string, msgs: WsMessage[]): void;
  addMessage(channelId: string, msg: WsMessage): void;
  updateMessage(channelId: string, id: string, patch: Partial<WsMessage>): void;
  removeMessage(channelId: string, id: string): void;
  setCurrentChannel(channelId: string | null): void;
  clearChannel(channelId: string): void;
  getMessages(channelId: string): WsMessage[];
};

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  cursors: {},
  currentChannelId: null,

  setMessages(channelId, incoming) {
    set((s) => {
      const existing = s.messages[channelId] ?? [];
      const byId = new Map<string, WsMessage>();
      for (const m of existing) byId.set(m.id, m);
      // Incoming wins on conflict (edits/pins from REST history load)
      for (const m of incoming) byId.set(m.id, m);
      const merged = Array.from(byId.values()).sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
      return { messages: { ...s.messages, [channelId]: merged } };
    });
  },

  addMessage(channelId, msg) {
    set((s) => {
      const existing = s.messages[channelId] ?? [];
      if (existing.some((m) => m.id === msg.id)) return s;
      return {
        messages: { ...s.messages, [channelId]: [...existing, msg] },
      };
    });
  },

  updateMessage(channelId, id, patch) {
    set((s) => {
      const msgs = s.messages[channelId] ?? [];
      return {
        messages: {
          ...s.messages,
          [channelId]: msgs.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        },
      };
    });
  },

  removeMessage(channelId, id) {
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: (s.messages[channelId] ?? []).filter((m) => m.id !== id),
      },
    }));
  },

  setCurrentChannel(channelId) {
    set({ currentChannelId: channelId });
  },

  clearChannel(channelId) {
    set((s) => {
      const msgs = { ...s.messages };
      delete msgs[channelId];
      return { messages: msgs };
    });
  },

  getMessages(channelId) {
    return get().messages[channelId] ?? [];
  },
}));
