import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Server } from "@/lib/api/schemas/servers.schema";

export type BanModalData = {
  serverId: string;
  serverName: string;
  expiresAt: string | null;
  reason: string | null;
};

type ServerStore = {
  servers: Server[];
  activeServerId: string | null;
  banModal: BanModalData | null;

  setServers: (servers: Server[]) => void;
  setActiveServer: (serverId: string) => void;
  removeServer: (serverId: string) => void;
  showBanModal: (data: BanModalData) => void;
  closeBanModal: () => void;
};

export const useServerStore = create<ServerStore>()(
  persist(
    (set) => ({
      servers: [],
      activeServerId: null,
      banModal: null,

      setServers: (servers) => set({ servers }),
      setActiveServer: (serverId) => set({ activeServerId: serverId }),

      removeServer: (serverId) =>
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== serverId),
          activeServerId:
            state.activeServerId === serverId ? null : state.activeServerId,
        })),

      showBanModal: (data) => set({ banModal: data }),
      closeBanModal: () => set({ banModal: null }),
    }),
    {
      name: "server-store",
      partialize: (state) => ({ activeServerId: state.activeServerId }),
    },
  ),
);
