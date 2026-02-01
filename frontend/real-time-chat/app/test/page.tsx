import { authApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";

export default async function TestPage() {
  let user: unknown = null;
  let errorMessage: string | null = null;

  try {
    user = await authApi.me();
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  if (errorMessage) {
    return (
      <div style={{ padding: 20 }}>
        <h1>TEST API : KO ❌</h1>
        <p>{errorMessage}</p>
        <p>
          👉 C’est NORMAL si tu n’es pas encore connecté.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>TEST API : OK ✅</h1>
      <p>Le frontend arrive à parler au backend.</p>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
}
