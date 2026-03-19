import { ApiError, parseApiError } from "./errors";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export class FetchClient {
  constructor(private baseUrl: string = "") {}

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Ajouter le token JWT si disponible
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError(
          0,
          "Le serveur met trop de temps a repondre. Verifiez qu'il est demarre et reessayez."
        );
      }
      throw new ApiError(0, "Impossible de contacter le serveur. Verifiez votre connexion.");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        const text = await res.text().catch(() => "");
        payload = text || null;
      }
      throw parseApiError(res.status, payload);
    }

    if (res.status === 204) return undefined as T;

    return (await res.json()) as T;
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }

  delete<T>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
