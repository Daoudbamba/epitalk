"use client";

import { useEffect, useMemo, useState } from "react";
import { channelsApi } from "@/lib/api";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useAuthStore } from "@/store/auth.store";
import { CreateChannelModal } from "@/components/forms/create-channel-modal";

type Status = { type: "success" | "error" | "info"; text: string } | null;

export function ChannelsSidebar({ onOpenSettings }: { onOpenSettings?: () => void }) {
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

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId],
  );

  const isOwner = !!activeServer && !!currentUser && activeServer.owner_id === currentUser.id;

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
      ? "border-emerald-200 text-emerald-700 bg-emerald-50/80"
      : status?.type === "error"
        ? "border-red-200 text-red-700 bg-red-50/80"
        : "border-[#023BFC]/20 text-[#023BFC] bg-[#EBF0FF]";

  return (
    <div className="h-[95%] rounded-2xl my-4 mx-2 flex flex-col bg-white/70 backdrop-blur-sm border border-[#E5E7EB] shadow-lg overflow-hidden">
      {/* Header with server name */}
      <div className="border-b border-[#E5E7EB]/50 px-5 py-4 flex items-center gap-3 bg-gradient-to-r from-white to-[#F7F8FA]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#023BFC]/10 to-[#023BFC]/5 flex items-center justify-center">
          <svg className="w-5 h-5 text-[#023BFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[#1A1A2E] truncate">
            {activeServer?.name ?? "Aucun serveur"}
          </div>
          <div className="text-xs text-[#6B7280]">
            {channels.length} channel{channels.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              disabled={!activeServerId}
              className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#023BFC] hover:border-[#023BFC]/50 flex items-center justify-center transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              title="Paramètres serveur"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={onCreate}
            disabled={!activeServerId || loading}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            title="Créer un channel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-auto p-4 space-y-2 scrollbar-thin">
        {!activeServerId ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-[#F7F8FA] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-sm text-[#6B7280]">Sélectionne un serveur</p>
            <p className="text-xs text-[#9CA3AF] mt-1">dans la barre de gauche</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-32">
            <div className="w-8 h-8 rounded-full border-2 border-[#023BFC] border-t-transparent animate-spin"></div>
            <p className="text-sm text-[#6B7280] mt-3">Chargement...</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-[#EBF0FF] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#023BFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </div>
            <p className="text-sm text-[#6B7280]">Aucun channel</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Crée le premier !</p>
          </div>
        ) : (
          channels.map((c) => {
            const active = c.id === activeChannelId;

            return (
              <div key={c.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => setActiveChannel(c.id)}
                  className={[
                    "flex-1 text-left rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300",
                    active
                      ? "channel-active bg-gradient-to-r from-[#023BFC] to-[#3D6AFF] text-white shadow-lg"
                      : "text-[#4B5563] hover:bg-[#F7F8FA] hover:text-[#023BFC] border border-transparent hover:border-[#E5E7EB]",
                  ].join(" ")}
                  title={active ? "Channel actif" : "Sélectionner"}
                >
                  <span className="flex items-center gap-2">
                    <span className={active ? "text-white/80" : "text-[#9CA3AF]"}>#</span>
                    {c.name}
                  </span>
                </button>

                {/* Delete button - visible on hover */}
                <button
                  onClick={() => onDelete(c.id)}
                  disabled={!activeServerId || loading || !isOwner}
                  className={[
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
                    "opacity-0 group-hover:opacity-100",
                    isOwner
                      ? "text-[#9CA3AF] hover:text-red-500 hover:bg-red-50"
                      : "text-[#D1D5DB] cursor-not-allowed",
                  ].join(" ")}
                  title={isOwner ? "Supprimer" : "Réservé au créateur"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Status with premium styling */}
      {status && (
        <div className={`border-t border-[#E5E7EB]/50 px-5 py-3 text-xs rounded-b-2xl ${statusClasses}`}>
          <div className="flex items-center gap-2">
            {status.type === "success" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status.type === "error" && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {status.text}
          </div>
        </div>
      )}

      {/* Modal création channel */}
      <CreateChannelModal
        open={openCreateChannel}
        onOpenChange={setOpenCreateChannel}
        serverId={activeServerId}
        onSuccess={handleChannelCreated}
      />
    </div>
  );
}
