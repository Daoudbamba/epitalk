import type { FetchClient } from "./fetchClient";
import type { Server, Channel, Member } from "./schemas/servers.schema";

export interface InviteResponse {
  code: string;
  server_id: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
}

export function createServersApi(client: FetchClient) {
  return {
    // Servers
    list: () => client.get<Server[]>("/servers"),
    get: (serverId: string) => client.get<Server>(`/servers/${serverId}`),
    create: (name: string) => client.post<Server>("/servers", { name }),
    update: (serverId: string, name: string) =>
      client.patch<Server>(`/servers/${serverId}`, { name }),
    delete: (serverId: string) => client.delete<void>(`/servers/${serverId}`),
    leave: (serverId: string) => client.post<void>(`/servers/${serverId}/leave`),
    transfer: (serverId: string, newOwnerId: string) =>
      client.post<void>(`/servers/${serverId}/transfer`, { new_owner_id: newOwnerId }),

    // Channels (nested under servers)
    listChannels: (serverId: string) =>
      client.get<Channel[]>(`/servers/${serverId}/channels`),
    getChannel: (serverId: string, channelId: string) =>
      client.get<Channel>(`/servers/${serverId}/channels/${channelId}`),
    createChannel: (serverId: string, name: string, channelType: string = "text") =>
      client.post<Channel>(`/servers/${serverId}/channels`, { name, channel_type: channelType }),
    updateChannel: (serverId: string, channelId: string, name: string) =>
      client.patch<Channel>(`/servers/${serverId}/channels/${channelId}`, { name }),
    deleteChannel: (serverId: string, channelId: string) =>
      client.delete<void>(`/servers/${serverId}/channels/${channelId}`),

    // Members (nested under servers)
    listMembers: (serverId: string) =>
      client.get<Member[]>(`/servers/${serverId}/members`),
    getMember: (serverId: string, memberId: string) =>
      client.get<Member>(`/servers/${serverId}/members/${memberId}`),
    updateMemberRole: (serverId: string, memberId: string, role: string) =>
      client.patch<Member>(`/servers/${serverId}/members/${memberId}`, { role }),
    kickMember: (serverId: string, memberId: string) =>
      client.delete<void>(`/servers/${serverId}/members/${memberId}`),

    // Invites
    createInvite: (serverId: string, expiresInHours?: number, maxUses?: number) =>
      client.post<InviteResponse>(`/servers/${serverId}/invites`, { 
        expires_in_hours: expiresInHours, 
        max_uses: maxUses 
      }),
    listInvites: (serverId: string) =>
      client.get<InviteResponse[]>(`/servers/${serverId}/invites`),
    
    // Join server via invite code (top-level route)
    joinByInvite: (code: string) =>
      client.post<Server>("/join", { code }),
  };
}
