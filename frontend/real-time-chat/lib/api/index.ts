import { FetchClient } from "./fetchClient";
import { AuthAPI } from "./auth.api";
import { createServersApi } from "./servers.api";
import { createChannelsApi } from "./channels.api";

const client = new FetchClient("/api");

export const authApi = new AuthAPI(client);
export const serversApi = createServersApi(client);
export const channelsApi = createChannelsApi(client);
