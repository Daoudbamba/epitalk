import type { FetchClient } from "./fetchClient";
import type { Server, Channel, Member, Invite } from "./schemas/servers.schema";
import type { Server, Channel, Member, Invite, Ban, BanMemberRequest } from "./schemas/servers.schema";

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
    // Backend expects { name, kind } where kind is "Text" (PascalCase)
    listChannels: (serverId: string) =>
      client.get<Channel[]>(`/servers/${serverId}/channels`),
    getChannel: (serverId: string, channelId: string) =>
      client.get<Channel>(`/servers/${serverId}/channels/${channelId}`),
    createChannel: (serverId: string, name: string, kind: "Text" = "Text") =>
      client.post<Channel>(`/servers/${serverId}/channels`, { name, kind }),
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
      client.patch<Member>(`/servers/${serverId}/members/${memberId}/role`, { role }),
    kickMember: (serverId: string, memberId: string) =>
      client.delete<void>(`/servers/${serverId}/members/${memberId}`),

    // Invites
    createInvite: (serverId: string, expiresInHours?: number, maxUses?: number) =>
      client.post<Invite>(`/servers/${serverId}/invites`, { 
        expires_in_hours: expiresInHours, 
        max_uses: maxUses 
      }),
    listInvites: (serverId: string) =>
      client.get<Invite[]>(`/servers/${serverId}/invites`),
    
    // Join server via invite code (top-level route)
    joinByInvite: (code: string) =>
      client.post<Server>("/join", { code }),
  };
}
