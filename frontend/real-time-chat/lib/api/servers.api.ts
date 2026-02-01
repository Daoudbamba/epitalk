//gère les serveurs

import { FetchClient } from "./fetchClient";
import { ServerListSchema, type Server } from "./schemas/servers.schema";

export class ServersAPI {
  private client: FetchClient;

  constructor(client: FetchClient) {
    this.client = client;
  }

  async list(): Promise<Server[]> {
    const response = await this.client.get<Server[]>("/servers");
    return ServerListSchema.parse(response);
  }
}
