import type { FetchClient } from "./fetchClient";
import { MessageListSchema, MessageSchema, type Message } from "./schemas/messages.schema";

export function createMessagesApi(client: FetchClient) {
  return {
    list: async (serverId: string, channelId: string): Promise<Message[]> => {
      const data = await client.get<Message[]>(
        `/servers/${serverId}/channels/${channelId}/messages`
      );
      return MessageListSchema.parse(data);
    },

    send: async (
      serverId: string,
      channelId: string,
      content: string
    ): Promise<Message> => {
      const data = await client.post<Message>(
        `/servers/${serverId}/channels/${channelId}/messages`,
        { content }
      );
      return MessageSchema.parse(data);
    },

    edit: async (
      serverId: string,
      channelId: string,
      messageId: string,
      content: string
    ): Promise<Message> => {
      const data = await client.patch<Message>(
        `/servers/${serverId}/channels/${channelId}/messages/${messageId}`,
        { content }
      );
      return MessageSchema.parse(data);
    },

    pin: async (serverId: string, channelId: string, messageId: string): Promise<void> => {
      await client.post<{ pinned: boolean }>(
        `/servers/${serverId}/channels/${channelId}/messages/${messageId}/pin`
      );
    },

    unpin: async (serverId: string, channelId: string, messageId: string): Promise<void> => {
      await client.delete<{ unpinned: boolean }>(
        `/servers/${serverId}/channels/${channelId}/messages/${messageId}/pin`
      );
    },
  };
}
