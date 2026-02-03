"use client";

import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { serversApi } from "@/lib/api";
import { ME } from "@/lib/me";
import { useMemo, useState } from "react";

function extractInviteCode(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  // Cas 1: lien complet contenant /invite/<code>
  const match = v.match(/\/invite\/([^/?#\s]+)/i);
  if (match?.[1]) return match[1].trim();

  // Cas 2: l’utilisateur a collé juste le code
  // (on accepte lettres/chiffres/underscore/tiret)
  const codeOnly = v.match(/^([a-z0-9_-]{4,64})$/i);
  if (codeOnly?.[1]) return codeOnly[1].trim();

  return null;
}

export function ServersBar({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const isOwner = !!activeServer && activeServer.ownerId === ME.id;

  const [inviteInput, setInviteInput] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

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

    const res = await fetch(`/api/servers/${activeServerId}/invite`, {
      method: "POST",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      alert(txt || "Erreur invitation");
      return;
    }

    const data = (await res.json()) as { code: string };
    const link = `${window.location.origin}/invite/${data.code}`;

    await navigator.clipboard.writeText(link).catch(() => {});
    alert(`Lien copié :\n${link}`);
  };

  const onJoin = async () => {
    const code = extractInviteCode(inviteInput);
    if (!code) {
      alert("Colle un lien /invite/<code> ou un code valide.");
      return;
    }

    setJoinLoading(true);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(code)}/join`, {
        method: "POST",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        alert(txt || "Invite invalide");
        return;
      }

      setInviteInput("");
      await onRefresh();
    } finally {
      setJoinLoading(false);
    }
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

  const joinDisabled = joinLoading || inviteInput.trim().length === 0;

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
        {/* ✅ Rejoindre via lien/code */}
        <input
          value={inviteInput}
          onChange={(e) => setInviteInput(e.target.value)}
          placeholder="Lien d’invite ou code..."
          className="h-9 w-56 rounded-md border px-3 text-sm bg-background"
        />

        <Button variant="outline" onClick={onJoin} disabled={joinDisabled}>
          {joinLoading ? "..." : "Rejoindre"}
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
