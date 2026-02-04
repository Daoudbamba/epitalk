import { create } from "zustand";
import type { Server } from "@/lib/api/schemas/servers.schema";

type ServerStore = {
  servers: Server[];
  activeServerId: string | null;

  setServers: (servers: Server[]) => void;
  setActiveServer: (serverId: string) => void;
};

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  activeServerId: null,

  setServers: (servers) => set({ servers }),
  setActiveServer: (serverId) => set({ activeServerId: serverId }),
}));
