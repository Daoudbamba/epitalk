"use client";

import { useServerStore } from "@/store/server.store";

export function MembersPanel() {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);

  const server = servers.find((s) => s.id === activeServerId) ?? null;

  if (!server) {
    return (
      <aside className="w-64 border-l p-4">
        <h3 className="text-sm font-semibold mb-4">Membres du serveur</h3>
        <p className="text-sm text-muted-foreground">Aucun serveur sélectionné</p>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-l p-4">
      <h3 className="text-sm font-semibold mb-4">Membres du serveur</h3>

      <ul className="space-y-2 text-sm">
        {server.members.map((m) => {
          const isOwner = m.id === server.ownerId;
          return (
            <li key={m.id}>
              🟢 {m.username} {isOwner ? "(Créateur)" : "(Membre)"}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
