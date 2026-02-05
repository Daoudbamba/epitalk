import { FetchClient } from "./fetchClient";
import { AuthAPI } from "./auth.api";
import { createServersApi } from "./servers.api";
import { createChannelsApi } from "./channels.api";
import { createMessagesApi } from "./messages.api";

// Use backend URL directly since Next.js rewrites don't work reliably with Turbopack
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const client = new FetchClient(`${API_BASE_URL}/api`);

export const authApi = new AuthAPI(client);
export const serversApi = createServersApi(client);
export const channelsApi = createChannelsApi(client);
export const messagesApi = createMessagesApi(client);
