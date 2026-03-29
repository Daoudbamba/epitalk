"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { serversApi } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { useAuthStore } from "@/store/auth.store";
import { useWebSocketStore } from "@/store/websocket.store";

export default function InviteJoinClient({ code }: { code: string }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const disconnect = useWebSocketStore((s) => s.disconnect);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onJoin = async () => {
    setLoading(true);
    setError(null);

    try {
      const cleanCode = code.trim();
      await serversApi.joinByInvite(cleanCode);

      router.push("/servers");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        disconnect();
        logout();
        router.replace("/login");
        return;
      }
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 space-y-4">
        <h1 className="text-lg font-semibold">Invitation</h1>

        <p className="text-sm text-muted-foreground">
          Code : <span className="font-mono">{code}</span>
        </p>

        {error && (
          <div className="text-sm text-red-500 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={onJoin} disabled={loading} className="flex-1">
            {loading ? "Connexion..." : "Rejoindre le serveur"}
          </Button>

          <Button variant="outline" onClick={() => router.push("/servers")} disabled={loading}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}
