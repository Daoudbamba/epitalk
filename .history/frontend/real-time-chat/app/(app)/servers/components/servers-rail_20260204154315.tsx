"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { serversApi } from "@/lib/api";

function initials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "NS";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "N";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "S";
  return (first + second).toUpperCase();
}

function extractInviteCode(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  const match = v.match(/\/invite\/([^/?#\s]+)/i);
  if (match?.[1]) return match[1].trim();

  const codeOnly = v.match(/^([a-z0-9_-]{4,64})$/i);
  if (codeOnly?.[1]) return codeOnly[1].trim();

  return null;
}

type Status = { type: "success" | "error" | "info"; text: string } | null;

export function ServersRail({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const currentUser = useAuthStore((s) => s.user);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const isOwner = !!activeServer && !!currentUser && activeServer.owner_id === currentUser.id;

  const [openSettings, setOpenSettings] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [loadingDanger, setLoadingDanger] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const setOk = (text: string) => setStatus({ type: "success", text });
  const setErr = (text: string) => setStatus({ type: "error", text });
  const setInfo = (text: string) => setStatus({ type: "info", text });

  const onCreateServer = async () => {
    const name = prompt("Nom du serveur ?");
    if (!name?.trim()) return;

    setStatus(null);
    await serversApi.create(name.trim());
    await onRefresh();
    setOk("Serveur créé.");
  };

  const onJoin = async () => {
    const code = extractInviteCode(inviteInput);
    if (!code) {
      setErr("Colle un lien /invite/<code> ou un code valide.");
      return;
    }

    setLoadingJoin(true);
    setStatus(null);

    try {
      await serversApi.joinByInvite(code);
      setInviteInput("");
      await onRefresh();
      setOk("Serveur rejoint.");
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Invite invalide");
    } finally {
      setLoadingJoin(false);
    }
  };

  const onInvite = async () => {
    if (!activeServerId) {
      setErr("Sélectionne un serveur.");
      return;
    }
    if (!isOwner) {
      setErr("Seul le créateur peut générer une invitation.");
      return;
    }

    setLoadingInvite(true);
    setStatus(null);
    setInviteLink(null);

    try {
      const invite = await serversApi.createInvite(activeServerId);
      const link = `${window.location.origin}/invite/${invite.code}`;
      setInviteLink(link);

      await navigator.clipboard.writeText(link).catch(() => {});
      setOk("Invitation générée (lien copié).");
    } catch (err) {
      setErr(err instanceof Error ? err.message : "Erreur invitation");
    } finally {
      setLoadingInvite(false);
    }
  };

  const onCopyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink).catch(() => {});
    setInfo("Lien copié.");
  };

  const onLeaveOrDelete = async () => {
    if (!activeServerId || !activeServer) {
      setErr("Sélectionne un serveur.");
      return;
    }

    setLoadingDanger(true);
    setStatus(null);

    try {
      if (isOwner) {
        const ok = confirm("Tu es le créateur. Supprimer le serveur ?");
        if (!ok) return;
        await serversApi.delete(activeServerId);
        setInfo("Serveur supprimé.");
      } else {
        const ok = confirm("Quitter ce serveur ?");
        if (!ok) return;
        await serversApi.leave(activeServerId);
        setInfo("Serveur quitté.");
      }

      await onRefresh();

      const after = useServerStore.getState().servers;
      const stillThere = after.some((s) => s.id === activeServerId);
      if (!stillThere) {
        const next = after[0]?.id ?? null;
        if (next) setActiveServer(next);
      }
    } finally {
      setLoadingDanger(false);
    }
  };

  const statusClasses =
    status?.type === "success"
      ? "border-green-200 text-green-700 bg-green-50"
      : status?.type === "error"
      ? "border-red-200 text-red-700 bg-red-50"
      : "border-zinc-200 text-zinc-700 bg-zinc-50";

  return (
    <aside className="w-23 my-5 mx-2 border-2 border-gray-200 rounded-md flex flex-col 
    items-center gap-3 py-8 bg-gray-400">

      <h1> BRIDGE </h1>
      

      {/* Add server */}
      <button
        onClick={onCreateServer}
        className="w-14 h-14 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xl flex items-center justify-center transition"
        title="Ajouter un serveur"
      >
        +
      </button>

      {/* Servers list */}
      <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-auto px-2">
        {servers.map((s) => {
          const active = s.id === activeServerId;
          return (
            <button
              key={s.id}
              onClick={() => setActiveServer(s.id)}
              className={[
                "w-14 h-14 rounded-2xl border transition flex items-center justify-center font-semibold",
                active
                  ? "bg-white text-black border-white shadow"
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20",
              ].join(" ")}
              title={s.name}
            >
              {initials(s.name)}
            </button>
          );
        })}
      </div>

      {/* Settings button (bottom) */}
      <button
        onClick={() => setOpenSettings(true)}
        className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition"
        title="Paramètres"
      >
        ⚙
      </button>

      {/* Modal settings */}
      {openSettings && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpenSettings(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-140 max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#1f2023] border border-white/10 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 flex items-center">
              <div className="font-semibold">
                Paramètres — {activeServer?.name ?? "Aucun serveur sélectionné"}
              </div>
              <button
                className="ml-auto text-sm px-3 py-1 rounded-md border border-black/10 dark:border-white/10"
                onClick={() => setOpenSettings(false)}
              >
                Fermer
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Join */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                <div className="text-sm font-semibold mb-2">Rejoindre un serveur</div>
                <div className="text-xs text-muted-foreground mb-3">
                  Colle un code ou un lien complet d’invite.
                </div>

                <div className="flex gap-2">
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Lien d’invite ou code..."
                    className="h-10 flex-1 rounded-md border px-3 text-sm bg-background"
                  />
                  <Button onClick={onJoin} disabled={loadingJoin || !inviteInput.trim()}>
                    {loadingJoin ? "..." : "Rejoindre"}
                  </Button>
                </div>
              </div>

              {/* Invite */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                <div className="text-sm font-semibold mb-2">Inviter sur mon serveur</div>
                <div className="text-xs text-muted-foreground mb-3">
                  Disponible uniquement pour le créateur (mock).
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={onInvite}
                    disabled={loadingInvite || !activeServerId}
                    title={isOwner ? "Générer" : "Réservé au créateur"}
                  >
                    {loadingInvite ? "..." : "Générer une invitation"}
                  </Button>

                  {inviteLink && (
                    <>
                      <div className="flex-1 text-xs rounded-md border px-3 py-2 bg-background font-mono overflow-hidden text-ellipsis">
                        {inviteLink}
                      </div>
                      <Button variant="outline" onClick={onCopyInvite}>
                        Copier
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Danger */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                <div className="text-sm font-semibold mb-2">
                  {isOwner ? "Supprimer le serveur" : "Quitter le serveur"}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  {isOwner
                    ? "Si tu es créateur, tu peux supprimer le serveur."
                    : "Si tu es membre, tu peux quitter le serveur."}
                </div>

                <Button
                  variant={isOwner ? "destructive" : "outline"}
                  onClick={onLeaveOrDelete}
                  disabled={loadingDanger || !activeServerId}
                >
                  {loadingDanger ? "..." : isOwner ? "Supprimer" : "Quitter"}
                </Button>
              </div>

              {status && (
                <div className={`text-xs border rounded-md px-3 py-2 ${statusClasses}`}>
                  {status.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
