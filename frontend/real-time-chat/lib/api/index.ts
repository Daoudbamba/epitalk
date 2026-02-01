//permet de créer une seule fois le fetchclient et les API, c'est le cerveau

import { FetchClient } from "./fetchClient";
import { AuthAPI } from "./auth.api";
import { ServersAPI } from "./servers.api";
import { createChannelsApi } from "./channels.api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const client = new FetchClient(API_URL);

export const authApi = new AuthAPI(client);
export const serversApi = new ServersAPI(client);
export const channelsApi = createChannelsApi(client);
