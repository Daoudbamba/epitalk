import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DmConversation } from "@/lib/api/dm.api";
import { dmApi } from "@/lib/api";

type DmState = {
  conversations: DmConversation[];
  activePeerId: string | null;
  loading: boolean;

  setConversations: (conversations: DmConversation[]) => void;
  setActivePeer: (peerId: string | null) => void;
  fetchConversations: () => Promise<void>;
  addOrUpdateConversation: (conv: DmConversation) => void;
};

export const useDmStore = create<DmState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activePeerId: null,
      loading: false,

      setConversations: (conversations) => set({ conversations }),

      setActivePeer: (peerId) => set({ activePeerId: peerId }),

      fetchConversations: async () => {
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

      addOrUpdateConversation: (conv) => {
        set((state) => {
          const existing = state.conversations.findIndex(
            (c) => c.conversation_id === conv.conversation_id
          );
          if (existing >= 0) {
            const updated = [...state.conversations];
            updated[existing] = conv;
            // Re-sort: most recent first
            updated.sort((a, b) =>
              b.last_message_at.localeCompare(a.last_message_at)
            );
            return { conversations: updated };
          }
          return {
            conversations: [conv, ...state.conversations],
          };
        });
      },
    }),
    {
      name: "dm-store",
      partialize: (state) => ({
        activePeerId: state.activePeerId,
      }),
    },
  ),
);
