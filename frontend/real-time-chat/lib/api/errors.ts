//Quand quelque chose se passe mal ce fichier explique tout et permet de comprendre l'erreur

// Ce type décrit TOUT ce que le backend peut renvoyer en cas d’erreur
export type ApiErrorPayload =
  | {
      message?: string;
      code?: string;
      details?: unknown;
      fieldErrors?: Record<string, string[]>;
    }
  | string
  | null;

// Erreur personnalisée que NOUS contrôlons
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  fieldErrors?: Record<string, string[]>;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Transforme la réponse backend en une erreur propre
export function parseApiError(
  status: number,
  payload: ApiErrorPayload
): ApiError {
  // Cas : backend renvoie un objet JSON
  if (typeof payload === "object" && payload !== null) {
    if ("message" in payload && typeof payload.message === "string") {
      return new ApiError(status, payload.message);
    }
  }

  // Cas : backend renvoie juste une string
  if (typeof payload === "string") {
    return new ApiError(status, payload);
  }

  // Cas : rien ou inconnu
  return new ApiError(status, "Erreur inconnue");
}

// Helper pour l’UI
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Une erreur est survenue";
}
