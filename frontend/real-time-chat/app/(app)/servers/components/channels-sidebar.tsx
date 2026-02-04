"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { channelsApi } from "@/lib/api";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { ME } from "@/lib/me";

type Status = { type: "success" | "error" | "info"; text: string } | null;

export function ChannelsSidebar() {
  const activeServerId = useServerStore((s) => s.activeServerId);
  const servers = useServerStore((s) => s.servers);

  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setChannels = useChannelStore((s) => s.setChannels);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const reset = useChannelStore((s) => s.reset);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId],
  );

  const isOwner = !!activeServer && activeServer.ownerId === ME.id;

  const setOk = (text: string) => setStatus({ type: "success", text });
  const setErr = (text: string) => setStatus({ type: "error", text });
  const setInfo = (text: string) => setStatus({ type: "info", text });

  const refresh = async () => {
    if (!activeServerId) {
      reset();
      setStatus(null);
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const data = await channelsApi.listByServer(activeServerId);
      setChannels(data);

      // ✅ si aucun actif OU actif pas dans cette liste, on sélectionne le 1er
      const stillExists = data.some((c) => c.id === activeChannelId);

      if ((!activeChannelId || !stillExists) && data.length > 0) {
        setActiveChannel(data[0].id);
      }
      if (data.length === 0) setActiveChannel(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur chargement channels");
      reset();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ✅ serveur changé : reset sélection + reload
    setActiveChannel(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerId]);

  const onCreate = async () => {
    if (!activeServerId) return;

    const name = prompt("Nom du channel ?");
    if (!name?.trim()) return;

    setStatus(null);
    setLoading(true);
    try {
      await channelsApi.create(activeServerId, name.trim());
      await refresh();
      setOk("Channel créé.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur création channel");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (channelId: string) => {
    if (!activeServerId) return;

    if (!isOwner) {
      setInfo("Suppression réservée au créateur (mock).");
      return;
    }

    const ok = confirm("Supprimer ce channel ?");
    if (!ok) return;

    setStatus(null);
    setLoading(true);

    try {
      await channelsApi.delete(activeServerId, channelId);

      // ✅ Si on supprime le channel actif : on choisit un autre channel
      const remaining = channels.filter((c) => c.id !== channelId);
      if (activeChannelId === channelId) {
        setActiveChannel(remaining[0]?.id ?? null);
      }

      await refresh();
      setOk("Channel supprimé.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur suppression channel");
    } finally {
      setLoading(false);
    }
  };

  const statusClasses =
    status?.type === "success"
      ? "border-green-200 text-green-700 bg-green-50"
      : status?.type === "error"
        ? "border-red-200 text-red-700 bg-red-50"
        : "border-zinc-200 text-zinc-700 bg-zinc-50";

  return (
    <div className="h-[95%] rounded-md my-5 mb-30 border-2 border-gray-200 flex flex-col">
      <div className="border-b px-4 py-3 flex items-center gap-2">
        <div className="text-sm font-semibold">
          {activeServer?.name ?? "Aucun serveur"}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={onCreate}
            disabled={!activeServerId || loading}
          >
            + Nouveau Channel
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {!activeServerId ? (
          <p className="text-sm text-muted-foreground">Aucun serveur</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun channel</p>
        ) : (
          channels.map((c) => {
            const active = c.id === activeChannelId;

            return (
              <div key={c.id} className="flex items-center gap-2">
                <button
                  onClick={() => setActiveChannel(c.id)}
                  className={`flex-1 text-left rounded-md px-2 py-1 text-sm border ${
                    active ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                  title={active ? "Channel actif" : "Sélectionner"}
                >
                  # {c.name}
                </button>

                {/* ✅ Delete visible mais désactivé si pas owner */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(c.id)}
                  disabled={!activeServerId || loading || (!isOwner && true)}
                  title={isOwner ? "Supprimer" : "Réservé au créateur"}
                >
                  ×
                </Button>
              </div>
            );
          })
        )}
      </div>

      {/* ✅ Status */}
      {status && (
        <div className={`border-t px-4 py-3 text-xs ${statusClasses}`}>
          {status.text}
        </div>
      )}
    </div>
  );
}
