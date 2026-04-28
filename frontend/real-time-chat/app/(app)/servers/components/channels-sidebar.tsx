"use client";

import { useEffect, useMemo, useState } from "react";
import { channelsApi } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useAuthStore } from "@/store/auth.store";
import { CreateChannelModal } from "@/components/forms/create-channel-modal";
import { useLanguage } from "@/components/language-provider";

type Status = { type: "success" | "error" | "info"; text: string } | null;

export function ChannelsSidebar({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const activeServerId = useServerStore((s) => s.activeServerId);
  const servers = useServerStore((s) => s.servers);
  const currentUser = useAuthStore((s) => s.user);

  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setChannels = useChannelStore((s) => s.setChannels);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const reset = useChannelStore((s) => s.reset);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [openCreateChannel, setOpenCreateChannel] = useState(false);
  const { language } = useLanguage();

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId],
  );

  const isOwner = !!activeServer && !!currentUser && activeServer.owner_id === currentUser.id;

  const setOk = (text: string) => setStatus({ type: "success", text });
  const setErr = (text: string) => setStatus({ type: "error", text });

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

      const currentActiveChannel = useChannelStore.getState().activeChannelId;
      const stillExists = data.some((c) => c.id === currentActiveChannel);

      if ((!currentActiveChannel || !stillExists) && data.length > 0) {
        setActiveChannel(data[0].id);
      }
      if (data.length === 0) setActiveChannel(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && e.code === "banned") {
        const details = e.details as { reason?: string | null; expires_at?: string | null } | null;
        const store = useServerStore.getState();
        store.removeServer(activeServerId!);
        store.showBanModal({
          serverId: activeServerId!,
          serverName: activeServer?.name ?? "ce serveur",
          expiresAt: details?.expires_at ?? null,
          reason: details?.reason ?? null,
        });
        reset();
        return;
      }
      setErr(e instanceof Error ? e.message : "Erreur chargement channels");
      reset();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerId]);

  const onCreate = () => {
    if (!activeServerId) return;
    setOpenCreateChannel(true);
  };

  const handleChannelCreated = async () => {
    await refresh();
    setOk("Channel créé.");
  };

  const onDelete = async (channelId: string) => {
    if (!activeServerId) return;

    if (!isOwner) {
      setStatus({ type: "info", text: "Suppression réservée au créateur." });
      return;
    }

    const ok = confirm("Supprimer ce channel ?");
    if (!ok) return;

    setStatus(null);
    setLoading(true);

    try {
      await channelsApi.delete(activeServerId, channelId);

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
      ? "border-emerald-200 text-emerald-700 bg-emerald-50/80"
      : status?.type === "error"
        ? "border-red-200 text-red-700 bg-red-50/80"
        : "border-et-purple/20 text-et-purple bg-purple-50/60";

  return (
    <div className="h-full flex flex-col bg-et-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-et-border px-3 py-3 flex items-center justify-between group shrink-0">
        <span className="text-[13px] font-medium uppercase tracking-[0.05em] text-et-title truncate">
          {activeServer?.name ?? (language === "en" ? "No server" : "Aucun serveur")}
        </span>
        <div className="flex items-center gap-1">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              disabled={!activeServerId}
              className="w-6 h-6 flex items-center justify-center text-et-muted hover:text-et-title transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={language === "en" ? "Server settings" : "Paramètres serveur"}
            >
              <i className="bi bi-gear text-[13px]" />
            </button>
          )}
          <button
            onClick={onCreate}
            disabled={!activeServerId || loading}
            className="w-6 h-6 flex items-center justify-center text-et-muted hover:text-et-title transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={language === "en" ? "Create a channel" : "Créer un channel"}
          >
            <i className="bi bi-plus text-[15px]" />
          </button>
        </div>
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {!activeServerId ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-et-muted">
              {language === "en" ? "Select a server" : "Sélectionne un serveur"}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 rounded-full border-2 border-et-orange border-t-transparent animate-spin" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-et-muted">
              {language === "en" ? "No channels yet." : "Aucun channel."}
            </p>
          </div>
        ) : (
          channels.map((c) => {
            const active = c.id === activeChannelId;

            return (
              <div key={c.id} className="flex items-center gap-1 group/item">
                <button
                  onClick={() => setActiveChannel(c.id)}
                  className={[
                    "flex-1 text-left px-2.5 py-1.5 text-[12px] font-medium uppercase transition-all duration-150 truncate",
                    active
                      ? "channel-et-active"
                      : "rounded-[6px] border border-et-border text-et-secondary hover:border-et-border hover:text-et-text",
                  ].join(" ")}
                >
                  {active
                    ? <span className="text-et-gradient"># {c.name}</span>
                    : `# ${c.name}`}
                </button>

                {/* Delete button — visible on hover, owner only */}
                <button
                  onClick={() => onDelete(c.id)}
                  disabled={!activeServerId || loading || !isOwner}
                  className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity text-et-muted hover:text-et-red-soft disabled:cursor-not-allowed disabled:opacity-30"
                  title={isOwner ? "Supprimer" : "Réservé au créateur"}
                >
                  <i className="bi bi-trash text-[11px]" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Status message */}
      {status && (
        <div className={`border-t border-et-border px-3 py-2 text-[11px] ${statusClasses}`}>
          {status.text}
        </div>
      )}

      {/* Create channel modal */}
      <CreateChannelModal
        open={openCreateChannel}
        onOpenChange={setOpenCreateChannel}
        serverId={activeServerId}
        onSuccess={handleChannelCreated}
      />
    </div>
  );
}
