"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";

export function MembersPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const currentUser = useAuthStore((s) => s.user);

  const server = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const [loadingKick, setLoadingKick] = useState<string | null>(null);

  const onKick = async (memberId: string) => {
    if (!server) return;

    const ok = confirm("Expulser ce membre ?");
    if (!ok) return;

    setLoadingKick(memberId);
    try {
      const res = await fetch(`/api/servers/${server.id}/members/${memberId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        alert(txt || "Erreur kick");
        return;
      }

      await onRefresh(); // ✅ refresh propre
    } finally {
      setLoadingKick(null);
    }
  };

  if (!server) {
    return (
      <aside className="w-64 border-l p-4">
        <h3 className="text-sm font-semibold mb-4">Membres</h3>
        <p className="text-sm text-muted-foreground">Aucun serveur sélectionné</p>
      </aside>
    );
  }

  const isOwner = !!currentUser && server.owner_id === currentUser.id;

  return (
    <aside className="h-[95%] rounded-md my-5 mb-30 border-2 border-gray-200 w-64 border-l p-4">
      <h3 className="text-sm font-semibold mb-1">
        Membres ({server.members.length})
      </h3>

      <p className="text-xs text-muted-foreground mb-4">
        Rôle : {isOwner ? "Créateur" : "Membre"}
      </p>

      <ul className="space-y-2 text-sm">
        {server.members.map((m) => {
          const memberIsOwner = m.id === server.ownerId;

          return (
            <li key={m.id} className="flex items-center gap-2">
              <span className="flex-1">
                {m.username} {memberIsOwner ? "(Créateur)" : "(Membre)"}
              </span>

              {isOwner && !memberIsOwner && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onKick(m.id)}
                  disabled={loadingKick === m.id}
                  title="Expulser"
                >
                  {loadingKick === m.id ? "..." : "×"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
