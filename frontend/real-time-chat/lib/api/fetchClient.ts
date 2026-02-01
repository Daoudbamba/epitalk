//le seul fichier qui communique directement avec le serveur 

import { parseApiError, type ApiErrorPayload } from "./errors";

type HttpMethod = "GET" | "POST";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
};

export class FetchClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data: ApiErrorPayload = null;

    try {
      data = (await response.json()) as ApiErrorPayload;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw parseApiError(response.status, data);
    }

    return data as T;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body,
    });
  }
}
