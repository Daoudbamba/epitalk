import type { FetchClient } from "./fetchClient";

export interface DmConversation {
  conversation_id: string;
  peer_id: string;
  peer_username: string;
  last_message: string;
  last_message_at: string;
}

export function createDmApi(client: FetchClient) {
  return {
    listConversations: () =>
      client.get<DmConversation[]>("/dm/conversations"),
  };
}
