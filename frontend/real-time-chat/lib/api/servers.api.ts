import type { FetchClient } from "./fetchClient";
import type { Server } from "./schemas/servers.schema";

export function createServersApi(client: FetchClient) {
  return {
    list: () => client.get<Server[]>("/servers"),

    create: (name: string) => client.post<Server>("/servers", { name }),

    join: (serverId: string) => client.post<Server>(`/servers/${serverId}/join`),

    leave: (serverId: string) =>
      client.post<Server>(`/servers/${serverId}/leave`),

    delete: (serverId: string) => client.delete<void>(`/servers/${serverId}`),
  };
}
