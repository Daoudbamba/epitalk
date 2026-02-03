"use client";

import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { serversApi } from "@/lib/api";
import { ME } from "@/lib/me";
import { useMemo } from "react";

export function ServersBar({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const isOwner = !!activeServer && activeServer.ownerId === ME.id;

  const onCreateServer = async () => {
    const name = prompt("Nom du serveur ?");
    if (!name?.trim()) return;

    await serversApi.create(name.trim());
    await onRefresh();
  };

  const onInvite = async () => {
    if (!activeServerId) return;

    if (!isOwner) {
      alert("Seul le créateur peut générer une invitation (mock).");
      return;
    }

    const res = await fetch(`/api/servers/${activeServerId}/invite`, { method: "POST" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      alert(txt || "Erreur invitation");
      return;
    }

    const data = (await res.json()) as { code: string };
    const link = `${window.location.origin}/invite/${data.code}`;

    await navigator.clipboard.writeText(link).catch(() => {});
    alert(`Lien copié (ou affiche-le) :\n${link}`);
  };

  const onJoinByCode = async () => {
    const code = prompt("Code d'invitation ?");
    if (!code?.trim()) return;

    const res = await fetch(`/api/invites/${code.trim()}/join`, { method: "POST" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      alert(txt || "Invite invalide");
      return;
    }

    await onRefresh();
  };

  const onLeaveOrDelete = async () => {
    if (!activeServerId || !activeServer) return;

    if (isOwner) {
      const ok = confirm("Tu es le créateur. Supprimer le serveur ?");
      if (!ok) return;
      await serversApi.delete(activeServerId);
    } else {
      const ok = confirm("Quitter ce serveur ?");
      if (!ok) return;
      await serversApi.leave(activeServerId);
    }

    await onRefresh();

    // recaler un serveur actif si celui-ci a disparu
    const after = useServerStore.getState().servers;
    const stillThere = after.some((s) => s.id === activeServerId);
    if (!stillThere) {
      const next = after[0]?.id ?? null;
      if (next) setActiveServer(next);
    }
  };

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      {servers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun serveur</p>
      ) : (
        servers.map((server) => (
          <Button
            key={server.id}
            variant={server.id === activeServerId ? "default" : "outline"}
            onClick={() => setActiveServer(server.id)}
          >
            {server.name}
          </Button>
        ))
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" onClick={onJoinByCode}>
          Rejoindre (code)
        </Button>

        <Button variant="outline" onClick={onInvite} disabled={!activeServerId}>
          Inviter
        </Button>

        <Button
          variant={isOwner ? "destructive" : "outline"}
          onClick={onLeaveOrDelete}
          disabled={!activeServerId}
          title={isOwner ? "Supprimer le serveur" : "Quitter le serveur"}
        >
          {isOwner ? "Supprimer" : "Quitter"}
        </Button>

        <Button onClick={onCreateServer}>+ Nouveau serveur</Button>
      </div>
    </div>
  );
}
