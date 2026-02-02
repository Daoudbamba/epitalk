"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { channelsApi } from "@/lib/api";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";

export function ChannelsSidebar() {
  const activeServerId = useServerStore((s) => s.activeServerId);

  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setChannels = useChannelStore((s) => s.setChannels);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const reset = useChannelStore((s) => s.reset);

  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!activeServerId) {
      reset();
      return;
    }

    setLoading(true);
    try {
      const data = await channelsApi.listByServer(activeServerId);
      setChannels(data);

      // ✅ si aucun actif OU actif pas dans cette liste, on sélectionne le 1er
      const stillExists = data.some((c) => c.id === activeChannelId);
      if ((!activeChannelId || !stillExists) && data.length > 0) {
        setActiveChannel(data[0].id);
      }
      if (data.length === 0) setActiveChannel(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ✅ serveur a changé : on reset sélection channel + on recharge
    setActiveChannel(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerId]);

  const onCreate = async () => {
    if (!activeServerId) return;
    const name = prompt("Nom du channel ?");
    if (!name?.trim()) return;
    await channelsApi.create(activeServerId, name.trim());
    await refresh();
  };

  const onDelete = async (channelId: string) => {
    if (!activeServerId) return;
    const ok = confirm("Supprimer ce channel ?");
    if (!ok) return;

    await channelsApi.delete(activeServerId, channelId);
    await refresh();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-3 flex items-center gap-2">
        <div className="text-sm font-semibold">Channels</div>
        <div className="ml-auto">
          <Button size="sm" onClick={onCreate} disabled={!activeServerId}>
            + Nouveau
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
                >
                  # {c.name}
                </button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(c.id)}
                  title="Supprimer"
                >
                  ×
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
