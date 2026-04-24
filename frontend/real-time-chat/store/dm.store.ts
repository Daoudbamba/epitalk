import { create } from "zustand";
import type { DmConversation } from "@/lib/api/dm.api";
import { dmApi } from "@/lib/api";
import type { WsMessage } from "@/lib/ws/types";

type DmState = {
  conversations: DmConversation[];
  activePeerId: string | null;
  loading: boolean;
  /** conversationId → ordered DM messages */
  dmMessages: Record<string, WsMessage[]>;

  setConversations(conversations: DmConversation[]): void;
  setActivePeer(peerId: string | null): void;
  fetchConversations(): Promise<void>;
  addOrUpdateConversation(conv: DmConversation): void;

  addDmMessage(conversationId: string, msg: WsMessage): void;
  updateDmMessage(conversationId: string, id: string, patch: Partial<WsMessage>): void;
  removeDmMessage(conversationId: string, id: string): void;
  getDmMessages(conversationId: string): WsMessage[];
};

export const useDmStore = create<DmState>((set, get) => ({
  conversations: [],
  activePeerId: null,
  loading: false,
  dmMessages: {},

  setConversations(conversations) {
    set({ conversations });
  },

  setActivePeer(peerId) {
    set({ activePeerId: peerId });
  },

  async fetchConversations() {
    set({ loading: true });
    try {
      const data = await dmApi.listConversations();
      set({ conversations: data });
    } catch (e) {
      console.error("Failed to fetch DM conversations:", e);
    } finally {
      set({ loading: false });
    }
  },

  addOrUpdateConversation(conv) {
    set((s) => {
      const idx = s.conversations.findIndex(
        (c) => c.conversation_id === conv.conversation_id,
      );
      if (idx >= 0) {
        const updated = [...s.conversations];
        updated[idx] = conv;
        updated.sort((a, b) =>
          b.last_message_at.localeCompare(a.last_message_at),
        );
        return { conversations: updated };
      }
      return { conversations: [conv, ...s.conversations] };
    });
  },

  addDmMessage(conversationId, msg) {
    set((s) => {
      const existing = s.dmMessages[conversationId] ?? [];
      if (existing.some((m) => m.id === msg.id)) return s;
      return {
        dmMessages: {
          ...s.dmMessages,
          [conversationId]: [...existing, msg],
        },
      };
    });
  },

  updateDmMessage(conversationId, id, patch) {
    set((s) => {
      const msgs = s.dmMessages[conversationId] ?? [];
      return {
        dmMessages: {
          ...s.dmMessages,
          [conversationId]: msgs.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        },
      };
    });
  },

  removeDmMessage(conversationId, id) {
    set((s) => ({
      dmMessages: {
        ...s.dmMessages,
        [conversationId]: (s.dmMessages[conversationId] ?? []).filter(
          (m) => m.id !== id,
        ),
      },
    }));
  },

  getDmMessages(conversationId) {
    return get().dmMessages[conversationId] ?? [];
  },
}));
