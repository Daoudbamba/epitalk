"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function InviteJoinClient({ code }: { code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onJoin = async () => {
    setLoading(true);
    setError(null);

    try {
      const cleanCode = code.trim();

      const res = await fetch(`/api/invites/${encodeURIComponent(cleanCode)}/join`, {
        method: "POST",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Invite not found");
      }

      router.push("/servers");
      router.refresh();
    } catch (e) {
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
