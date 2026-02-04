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
  };
}
