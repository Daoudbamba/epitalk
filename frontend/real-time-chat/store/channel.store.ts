import { create } from "zustand";
import type { Channel } from "@/lib/api/schemas/channels.schema";

type ChannelStore = {
  channels: Channel[];
  activeChannelId: string | null;

  setChannels: (channels: Channel[]) => void;
  setActiveChannel: (channelId: string) => void;
};

export const useChannelStore = create<ChannelStore>((set) => ({
  channels: [],
  activeChannelId: null,

  setChannels: (channels) => set({ channels }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
}));
