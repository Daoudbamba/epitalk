"use client";

import { useEffect, useMemo, useState } from "react";
import { Hash, ChevronDown, Settings, Plus, Trash2, UserPlus, Copy, Check } from "lucide-react";
import { channelsApi, serversApi } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { CreateChannelModal } from "@/components/forms/create-channel-modal";
import { useLanguage } from "@/components/language-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [openInviteDialog, setOpenInviteDialog] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const members = useMemberStore((s) => s.members);

  const myRole = useMemo(() => {
    if (!currentUser) return null;
    return members.find((m) => m.user_id === currentUser.id)?.role ?? null;
  }, [members, currentUser]);

  const canInvite = myRole === "Owner" || myRole === "Admin" || myRole === "Moderator";

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId],
  );

  const isOwner =
    !!activeServer && !!currentUser && activeServer.owner_id === currentUser.id;

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
        const details = e.details as {
          reason?: string | null;
          expires_at?: string | null;
        } | null;
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

  const onOpenInviteDialog = async () => {
    if (!activeServerId) return;
    setInviteLink(null);
    setCopied(false);
    setOpenInviteDialog(true);
    setLoadingInvite(true);
    try {
      const invite = await serversApi.createInvite(activeServerId);
      const link = `${window.location.origin}/invite/${invite.code}`;
      setInviteLink(link);
    } catch (e) {
      setInviteLink(null);
    } finally {
      setLoadingInvite(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
      : status?.type === "error"
        ? "border-red-200 text-red-700 bg-red-50"
        : "border-blue-200 text-blue-700 bg-blue-50";

  return (
    <div className="flex flex-col w-60 min-h-full bg-[#F5F5F5] border-r border-[#D5DAE0] overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#D5DAE0] shrink-0">
        <span className="text-[#003D82] text-[15px] font-semibold truncate flex-1">
          {activeServer?.name ??
            (language === "en" ? "No server" : "Aucun serveur")}
        </span>
        <ChevronDown size={16} className="text-[#8A929C] w-4 h-4 cursor-pointer hover:text-[#333333] shrink-0 ml-1" />
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-auto py-3 px-2">
        {!activeServerId ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-[#8A929C]">
              {language === "en" ? "Select a server" : "Sélectionne un serveur"}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-4 h-4 rounded-full border-2 border-[#0066CC] border-t-transparent animate-spin" />
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-[#8A929C]">
              {language === "en" ? "No channels yet." : "Aucun channel."}
            </p>
          </div>
        ) : (
          channels.map((c) => {
            const active = c.id === activeChannelId;
            const unread = !active && (c as any).unread_count > 0;
            const mentions = (c as any).mention_count as number | undefined;
            return (
              <div
                key={c.id}
                onClick={() => setActiveChannel(c.id)}
                className={[
                  "group relative flex items-center gap-2 h-9 px-2 rounded cursor-pointer select-none transition-colors duration-120",
                  active
                    ? "bg-[#E6F0FB] text-[#0066CC] font-medium hover:bg-[#DCE9F8]"
                    : unread
                      ? "text-[#333333] font-medium hover:bg-[#ECEEF1]"
                      : "text-[#6B737D] hover:bg-[#ECEEF1] hover:text-[#333333]",
                ].join(" ")}
              >
                {unread && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0066CC] absolute left-0.5" />
                )}
                <Hash size={14} className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate text-[14px]">{c.name}</span>
                {mentions && mentions > 0 && (
                  <span className="min-w-4.5 h-4.5 rounded-full bg-[#FF6B35] text-white text-[10px] font-mono font-semibold flex items-center justify-center px-1">
                    {mentions}
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  disabled={!activeServerId || loading || !isOwner}
                  className="opacity-0 group-hover:opacity-100 w-5.5 h-5.5 rounded flex items-center justify-center text-[#8A929C] hover:text-[#FF6B35] hover:bg-[#ECEEF1] transition-all duration-120 disabled:cursor-not-allowed disabled:opacity-30"
                  title={isOwner ? "Supprimer" : "Réservé au créateur"}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Status message */}
      {status && (
        <div
          className={`border-t border-[#D5DAE0] px-3 py-2 text-[11px] ${statusClasses}`}
        >
          {status.text}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 p-3 border-t border-[#D5DAE0] shrink-0">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            disabled={!activeServerId}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 px-3 rounded border border-[#D5DAE0] bg-transparent text-[#6B737D] text-[13px] hover:bg-[#F5F7FA] hover:text-[#333333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={isEnglish ? "Server settings" : "Paramètres serveur"}
          >
            <Settings size={14} />
            {isEnglish ? "Settings" : "Paramètres"}
          </button>
        )}
        {canInvite && (
          <button
            onClick={onOpenInviteDialog}
            disabled={!activeServerId || loadingInvite}
            className="flex items-center gap-1.5 h-9 px-3 rounded border border-[#D5DAE0] bg-transparent text-[#6B737D] text-[13px] hover:bg-[#F5F7FA] hover:text-[#333333] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            title={isEnglish ? "Invite a member" : "Inviter un membre"}
          >
            <UserPlus size={14} />
            {isEnglish ? "Invite" : "Inviter"}
          </button>
        )}
        <button
          onClick={onCreate}
          disabled={!activeServerId || loading}
          className="flex items-center gap-1.5 h-9 px-3 rounded bg-[#0066CC] text-white text-[13px] font-medium hover:bg-[#0055AA] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          title={isEnglish ? "Create a channel" : "Créer un channel"}
        >
          <Plus size={14} />
          {isEnglish ? "Channel" : "Channel"}
        </button>
      </div>

      {/* Create channel modal */}
      <CreateChannelModal
        open={openCreateChannel}
        onOpenChange={setOpenCreateChannel}
        serverId={activeServerId}
        onSuccess={handleChannelCreated}
        serverName={activeServer?.name}
      />

      {/* Invite dialog */}
      <Dialog open={openInviteDialog} onOpenChange={setOpenInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEnglish ? "Invite a member" : "Inviter un membre"}
            </DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "Share this link to let someone join your server."
                : "Partage ce lien pour inviter quelqu'un sur ton serveur."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            {loadingInvite ? (
              <div className="flex items-center justify-center h-12">
                <div className="w-5 h-5 rounded-full border-2 border-[#0066CC] border-t-transparent animate-spin" />
              </div>
            ) : inviteLink ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 h-9 px-3 rounded border border-[#D5DAE0] bg-[#F5F5F5] text-[13px] text-[#333333] font-mono outline-none select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copyInviteLink}
                  className="h-9 w-9 flex items-center justify-center rounded border border-[#D5DAE0] bg-transparent text-[#6B737D] hover:bg-[#F5F7FA] hover:text-[#333333] transition-colors"
                  title={isEnglish ? "Copy" : "Copier"}
                >
                  {copied ? <Check size={14} className="text-[#2BAE5C]" /> : <Copy size={14} />}
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-red-600">
                {isEnglish
                  ? "Failed to generate invite link."
                  : "Erreur lors de la génération du lien."}
              </p>
            )}
            {inviteLink && (
              <p className="mt-2 text-[11px] text-[#8A929C]">
                {isEnglish
                  ? "This link expires in 24 hours."
                  : "Ce lien expire dans 24 heures."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
