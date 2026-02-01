import { FetchClient } from "./fetchClient";
import {
  ChannelListSchema,
  ChannelSchema,
  CreateChannelInputSchema,
  type Channel,
  type CreateChannelInput,
} from "./schemas/channels.schema";

export function createChannelsApi(client: FetchClient) {
  return {
    async listByServer(serverId: string): Promise<Channel[]> {
      const res = await client.get<Channel[]>(`/servers/${serverId}/channels`);
      return ChannelListSchema.parse(res);
    },

    async create(input: CreateChannelInput): Promise<Channel> {
      const data = CreateChannelInputSchema.parse(input);
      const res = await client.post<Channel>("/channels", data);
      return ChannelSchema.parse(res);
    },

    async get(channelId: string): Promise<Channel> {
      const res = await client.get<Channel>(`/channels/${channelId}`);
      return ChannelSchema.parse(res);
    },
  };
}
