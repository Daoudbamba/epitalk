import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Channel } from "@/lib/api/schemas/channels.schema";

type ChannelState = {
  channels: Channel[];
  /** All channels across every server — used for notification lookup only, not persisted */
  allChannels: Channel[];
  activeChannelId: string | null;
  setChannels: (channels: Channel[]) => void;
  addChannelsForServer: (serverId: string, channels: Channel[]) => void;
  setActiveChannel: (id: string | null) => void;
  reset: () => void;
};

export const useChannelStore = create<ChannelState>()(
  persist(
    (set) => ({
      channels: [],
      allChannels: [],
      activeChannelId: null,
      setChannels: (channels) => set({ channels }),
      addChannelsForServer: (serverId, channels) =>
        set((s) => ({
          allChannels: [
            ...s.allChannels.filter((c) => c.server_id !== serverId),
            ...channels,
          ],
        })),
      setActiveChannel: (id) => set({ activeChannelId: id }),
      reset: () => set({ channels: [], activeChannelId: null }),
    }),
    {
      name: "channel-store",
      partialize: (state) => ({ activeChannelId: state.activeChannelId }),
    },
  ),
);
