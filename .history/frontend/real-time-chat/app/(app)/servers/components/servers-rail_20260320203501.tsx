"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useAuthStore } from "@/store/auth.store";
import { channelsApi, serversApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import type { Invite, Server } from "@/lib/api/schemas/servers.schema";
import { UserSettings } from "./user-settings";
import { CreateServerModal } from "@/components/forms/create-server-modal";
import { CreateChannelModal } from "@/components/forms/create-channel-modal";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

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
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setChannels = useChannelStore((s) => s.setChannels);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const currentUser = useAuthStore((s) => s.user);

  const activeServer = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const isOwner = !!activeServer && !!currentUser && activeServer.owner_id === currentUser.id;

  const [openSettings, setOpenSettings] = useState(false);
  const [openCreateServer, setOpenCreateServer] = useState(false);
  const [openCreateChannel, setOpenCreateChannel] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [loadingInvitesList, setLoadingInvitesList] = useState(false);
  const [loadingRevokeInviteCode, setLoadingRevokeInviteCode] = useState<string | null>(null);
  const [loadingDanger, setLoadingDanger] = useState(false);
  const [loadingTransferCandidates, setLoadingTransferCandidates] = useState(false);
  const [loadingTransfer, setLoadingTransfer] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [openDangerConfirm, setOpenDangerConfirm] = useState(false);
  const [openRevokeInviteConfirm, setOpenRevokeInviteConfirm] = useState(false);
  const [openTransferConfirm, setOpenTransferConfirm] = useState(false);
  const [activeInvites, setActiveInvites] = useState<Invite[]>([]);
  const [serverDetails, setServerDetails] = useState<Server | null>(null);
  const [loadingServerDetails, setLoadingServerDetails] = useState(false);
  const [pendingRevokeInviteCode, setPendingRevokeInviteCode] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferCandidates, setTransferCandidates] = useState<
    Array<{ user_id: string; username: string; role: string }>
  >([]);

  const setOk = (text: string) => setStatus({ type: "success", text });
  const setErr = (text: string) => setStatus({ type: "error", text });
  const setInfo = (text: string) => setStatus({ type: "info", text });

  const selectedTransferMember = useMemo(
    () => transferCandidates.find((m) => m.user_id === transferTargetId) ?? null,
    [transferCandidates, transferTargetId]
  );

  const loadServerDetails = async (serverId: string) => {
    setLoadingServerDetails(true);
    try {
      const details = await serversApi.get(serverId);
      setServerDetails(details);
    } catch (err) {
      setErr(getErrorMessage(err));
      setServerDetails(null);
    } finally {
      setLoadingServerDetails(false);
    }
  };

  const loadActiveInvites = async (serverId: string) => {
    setLoadingInvitesList(true);
    try {
      const data = await serversApi.listActiveInvites(serverId);
      setActiveInvites(data);
    } catch (err) {
      setErr(getErrorMessage(err));
      setActiveInvites([]);
    } finally {
      setLoadingInvitesList(false);
    }
  };

  const formatInviteMeta = (invite: Invite): string => {
    const usesPart = invite.max_uses === null
      ? `${invite.uses} utilisations`
      : `${invite.uses}/${invite.max_uses} utilisations`;
    const expiryPart = invite.expires_at
      ? `Expire le ${new Date(invite.expires_at).toLocaleString()}`
      : "Sans expiration";
    return `${usesPart} • ${expiryPart}`;
  };

  useEffect(() => {
    if (!openSettings || !activeServerId || !isOwner) {
      setActiveInvites([]);
      setPendingRevokeInviteCode("");
      return;
    }

    void loadActiveInvites(activeServerId);
  }, [activeServerId, isOwner, openSettings]);

  useEffect(() => {
    if (!openSettings || !activeServerId) {
      setServerDetails(null);
      return;
    }

    void loadServerDetails(activeServerId);
  }, [activeServerId, openSettings]);

  useEffect(() => {
    if (!openSettings || !activeServerId || !isOwner || !currentUser) {
      setTransferCandidates([]);
      setTransferTargetId("");
      return;
    }

    let cancelled = false;

    const loadTransferCandidates = async () => {
      setLoadingTransferCandidates(true);
      try {
        const members = await serversApi.listMembers(activeServerId);
        if (cancelled) return;

        const eligible = members.filter(
          (member) => member.user_id !== currentUser.id && member.role !== "Owner"
        );

        setTransferCandidates(eligible);
        setTransferTargetId((prev) => {
          if (prev && eligible.some((member) => member.user_id === prev)) {
            return prev;
          }
          return eligible[0]?.user_id ?? "";
        });
      } catch (err) {
        if (!cancelled) {
          setErr(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoadingTransferCandidates(false);
        }
      }
    };

    loadTransferCandidates();

    return () => {
      cancelled = true;
    };
  }, [activeServerId, currentUser, isOwner, openSettings]);

  const onCreateServer = () => {
    setOpenCreateServer(true);
  };

  const onCreateChannel = () => {
    if (!activeServerId) {
      setErr("Selectionne un serveur avant de creer un channel.");
      return;
    }
    setOpenCreateChannel(true);
  };

  const handleChannelCreated = async () => {
    if (!activeServerId) return;

    const data = await channelsApi.listByServer(activeServerId);
    setChannels(data);

    const stillExists = data.some((channel) => channel.id === activeChannelId);
    if ((!activeChannelId || !stillExists) && data.length > 0) {
      setActiveChannel(data[0].id);
    }
    if (data.length === 0) {
      setActiveChannel(null);
    }

    await onRefresh();
    setOk("Channel cree.");
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
      setErr(getErrorMessage(err));
    } finally {
      setLoadingJoin(false);
    }
  };

  const onInvite = async () => {
    if (!activeServerId) {
      setErr("Selectionne un serveur.");
      return;
    }
    if (!isOwner) {
      setErr("Seul le createur peut generer une invitation.");
      return;
    }

    setLoadingInvite(true);
    setStatus(null);
    setInviteLink(null);

    try {
      const invite = await serversApi.createInvite(activeServerId);
      const link = `${window.location.origin}/invite/${invite.code}`;
      setInviteLink(link);

      await loadActiveInvites(activeServerId);

      await navigator.clipboard.writeText(link).catch(() => {});
      setOk("Invitation generee (lien copie).");
    } catch (err) {
      setErr(getErrorMessage(err));
    } finally {
      setLoadingInvite(false);
    }
  };

  const onCopyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink).catch(() => {});
    setInfo("Lien copie.");
  };

  const onLeaveOrDelete = async () => {
    if (!activeServerId || !activeServer) {
      setErr("Selectionne un serveur.");
      return;
    }

    setOpenDangerConfirm(true);
  };

  const onRevokeInvite = (inviteCode: string) => {
    setPendingRevokeInviteCode(inviteCode);
    setOpenRevokeInviteConfirm(true);
  };

  const confirmRevokeInvite = async () => {
    if (!activeServerId || !pendingRevokeInviteCode) return;

    setLoadingRevokeInviteCode(pendingRevokeInviteCode);
    setStatus(null);

    try {
      await serversApi.deleteInvite(activeServerId, pendingRevokeInviteCode);
      await loadActiveInvites(activeServerId);
      setOpenRevokeInviteConfirm(false);
      setPendingRevokeInviteCode("");
      setInfo("Invitation revoquee.");
    } catch (err) {
      setErr(getErrorMessage(err));
    } finally {
      setLoadingRevokeInviteCode(null);
    }
  };

  const confirmLeaveOrDelete = async () => {
    if (!activeServerId || !activeServer) return;

    setLoadingDanger(true);
    setStatus(null);

    try {
      if (isOwner) {
        await serversApi.delete(activeServerId);
        setInfo("Serveur supprime.");
      } else {
        await serversApi.leave(activeServerId);
        setInfo("Serveur quitte.");
      }

      await onRefresh();

      const after = useServerStore.getState().servers;
      const stillThere = after.some((s) => s.id === activeServerId);
      if (!stillThere) {
        const next = after[0]?.id ?? null;
        if (next) setActiveServer(next);
      }
      setOpenDangerConfirm(false);
    } finally {
      setLoadingDanger(false);
    }
  };

  const onTransferOwnership = async () => {
    if (!activeServerId || !transferTargetId) {
      setErr("Selectionne un membre eligible.");
      return;
    }
    setOpenTransferConfirm(true);
  };

  const confirmTransferOwnership = async () => {
    if (!activeServerId || !transferTargetId) return;

    setLoadingTransfer(true);
    setStatus(null);

    try {
      await serversApi.transfer(activeServerId, transferTargetId);
      await onRefresh();
      setOpenTransferConfirm(false);
      setInfo("Propriete du serveur transferee.");
    } catch (err) {
      setErr(getErrorMessage(err));
    } finally {
      setLoadingTransfer(false);
    }
  };

  const statusClasses =
    status?.type === "success"
      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
      : status?.type === "error"
      ? "border-red-200 text-red-700 bg-red-50"
      : "border-[#023BFC]/20 text-[#023BFC] bg-[#EBF0FF]";

  return (
    <aside className="w-[88px] my-4 ml-3 rounded-2xl flex flex-col items-center gap-4 py-6 bg-gradient-to-b from-[#F7F8FA] to-white border border-[#E5E7EB] shadow-lg">

      {/* Logo */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center shadow-lg glow-blue-sm">
        <span className="text-white font-bold text-lg">B</span>
      </div>
      
      <div className="w-10 h-px bg-gradient-to-r from-transparent via-[#E5E7EB] to-transparent" />

      {/* Add server */}
      <button
        onClick={onCreateServer}
        className="w-12 h-12 server-icon bg-white hover:bg-[#EBF0FF] border-2 border-dashed border-[#023BFC]/30 hover:border-[#023BFC] text-[#023BFC] text-2xl flex items-center justify-center transition-all duration-300 hover:scale-105"
        title="Creer un serveur"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Add channel */}
      <button
        onClick={onCreateChannel}
        disabled={!activeServerId}
        className="w-12 h-12 server-icon bg-white hover:bg-[#EBF0FF] border-2 border-dashed border-[#10B981]/30 hover:border-[#10B981] text-[#10B981] text-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        title={activeServerId ? "Creer un channel" : "Selectionne un serveur"}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Servers list */}
      <div className="flex-1 w-full flex flex-col items-center gap-3 overflow-auto px-3 py-2">
        {servers.map((s) => {
          const active = s.id === activeServerId;
          return (
            <button
              key={s.id}
              onClick={() => setActiveServer(s.id)}
              className={[
                "w-12 h-12 transition-all duration-300 flex items-center justify-center font-semibold text-sm",
                active
                  ? "server-icon-active bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] text-white rounded-2xl"
                  : "server-icon bg-white text-[#1A1D26] border border-[#E5E7EB] hover:border-[#023BFC]/50 hover:text-[#023BFC]",
              ].join(" ")}
              title={s.name}
            >
              {initials(s.name)}
            </button>
          );
        })}
      </div>

      <div className="w-10 h-px bg-gradient-to-r from-transparent via-[#E5E7EB] to-transparent" />

      {/* User Settings (Profile / Logout) */}
      <div className="mt-auto">
        <UserSettings />
      </div>

      {/* Settings button (bottom) - Server settings */}
      <button
        onClick={() => setOpenSettings(true)}
        className="w-12 h-12 server-icon bg-white hover:bg-[#F7F8FA] border border-[#E5E7EB] text-[#6B7280] hover:text-[#023BFC] flex items-center justify-center transition-all duration-300"
        title="Parametres serveur"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Modal settings - Premium glassmorphism */}
      {openSettings && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpenSettings(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-140 max-h-[65vh] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-3xl glass border border-white/30 shadow-2xl overflow-hidden flex flex-col">
            {/* Header with gradient */}
            <div className="px-6 py-5 border-b border-[#E5E7EB]/50 flex items-center bg-gradient-to-r from-[#023BFC]/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#023BFC] to-[#0066FF] flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-[#1A1A2E]">Parametres</div>
                  <div className="text-xs text-[#6B7280]">{activeServer?.name ?? "Aucun serveur selectionne"}</div>
                </div>
              </div>
              <button
                title="Fermer les paramètres"
                aria-label="Fermer les paramètres"
                className="ml-auto w-9 h-9 rounded-xl bg-[#F7F8FA] hover:bg-[#E5E7EB] border border-[#E5E7EB] flex items-center justify-center transition-all duration-300"
                onClick={() => setOpenSettings(false)}
              >
                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="rounded-2xl border border-[#E5E7EB]/50 p-5 bg-white/60 neu-shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[#1A1A2E]">Details du serveur</div>
                    <div className="text-xs text-[#6B7280]">Informations recuperees depuis l'endpoint detail.</div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (activeServerId) {
                        void loadServerDetails(activeServerId);
                      }
                    }}
                    disabled={loadingServerDetails || !activeServerId}
                    className="h-8 px-3 text-[11px]"
                  >
                    {loadingServerDetails ? "..." : "Rafraichir"}
                  </Button>
                </div>

                {loadingServerDetails ? (
                  <div className="text-xs text-[#6B7280]">Chargement des details...</div>
                ) : serverDetails ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#1A1A2E]">
                    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
                      <span className="font-semibold">Nom:</span> {serverDetails.name}
                    </div>
                    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2">
                      <span className="font-semibold">Membres:</span> {serverDetails.member_count ?? "-"}
                    </div>
                    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 sm:col-span-2">
                      <span className="font-semibold">Owner ID:</span> {serverDetails.owner_id}
                    </div>
                    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 sm:col-span-2">
                      <span className="font-semibold">Cree le:</span> {new Date(serverDetails.created_at).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#6B7280]">Impossible de charger les details du serveur.</div>
                )}
              </div>

              {/* Join */}
              <div className="rounded-2xl border border-[#E5E7EB]/50 p-5 bg-white/50 hover:bg-white/70 transition-all duration-300 neu-shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="text-sm font-bold text-[#1A1A2E]">Rejoindre un serveur</div>
                </div>
                <div className="text-xs text-[#6B7280] mb-4">
                  Colle un code ou un lien complet d&apos;invitation.
                </div>

                <div className="flex gap-3">
                  <input
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Lien d'invite ou code..."
                    className="h-11 flex-1 rounded-xl border border-[#E5E7EB] px-4 text-sm bg-white/80 focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20 outline-none transition-all duration-300"
                  />
                  <Button onClick={onJoin} disabled={loadingJoin || !inviteInput.trim()} className="btn-premium h-11 px-5">
                    {loadingJoin ? "..." : "Rejoindre"}
                  </Button>
                </div>
              </div>

              {/* Invite */}
              <div className="rounded-2xl border border-[#E5E7EB]/50 p-5 bg-white/50 hover:bg-white/70 transition-all duration-300 neu-shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#023BFC] to-[#0066FF] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div className="text-sm font-bold text-[#1A1A2E]">Inviter sur mon serveur</div>
                </div>
                <div className="text-xs text-[#6B7280] mb-4">
                  Génère un lien d&apos;invitation à partager.
                </div>

                <div className="flex gap-3 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={onInvite}
                    disabled={loadingInvite || !activeServerId}
                    title={isOwner ? "Generer" : "Reserve au createur"}
                    className="h-11 px-5 rounded-xl border-[#E5E7EB] hover:border-[#023BFC] hover:bg-[#023BFC]/5 transition-all duration-300"
                  >
                    {loadingInvite ? "..." : "Generer une invitation"}
                  </Button>

                  {inviteLink && (
                    <>
                      <div className="flex-1 min-w-[200px] text-xs rounded-xl border border-[#E5E7EB] px-4 py-3 bg-[#F7F8FA] font-mono overflow-hidden text-ellipsis text-[#1A1A2E]">
                        {inviteLink}
                      </div>
                      <Button variant="outline" onClick={onCopyInvite} className="h-11 px-4 rounded-xl border-[#023BFC] text-[#023BFC] hover:bg-[#023BFC] hover:text-white transition-all duration-300">
                        Copier
                      </Button>
                    </>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white/70 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#1A1A2E]">Invitations actives</div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (activeServerId) {
                          void loadActiveInvites(activeServerId);
                        }
                      }}
                      disabled={loadingInvitesList || !activeServerId || !isOwner}
                      className="h-7 px-2 text-[11px]"
                    >
                      {loadingInvitesList ? "..." : "Rafraichir"}
                    </Button>
                  </div>

                  {!isOwner ? (
                    <div className="text-xs text-[#6B7280]">
                      La gestion des invitations est reservee au createur.
                    </div>
                  ) : loadingInvitesList ? (
                    <div className="text-xs text-[#6B7280]">Chargement des invitations...</div>
                  ) : activeInvites.length === 0 ? (
                    <div className="text-xs text-[#6B7280]">Aucune invitation active.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeInvites.map((invite) => (
                        <div key={invite.code} className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white p-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-xs text-[#1A1A2E]">{invite.code}</div>
                            <div className="truncate text-[11px] text-[#6B7280]">{formatInviteMeta(invite)}</div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => onRevokeInvite(invite.code)}
                            disabled={loadingRevokeInviteCode === invite.code}
                            className="h-8 px-3 text-[11px] border-red-300 text-red-600 hover:bg-red-50"
                          >
                            {loadingRevokeInviteCode === invite.code ? "..." : "Revoquer"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Danger */}
              {isOwner && (
                <div className="rounded-2xl border border-amber-200/60 p-5 bg-amber-50/40 hover:bg-amber-50/60 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5V4H2v16h5m10 0v-5a3 3 0 00-6 0v5m6 0H7" />
                      </svg>
                    </div>
                    <div className="text-sm font-bold text-amber-800">Transfert de propriete</div>
                  </div>

                  <div className="text-xs text-amber-700/90 mb-4">
                    Choisis le nouveau proprietaire. Cette action est sensible et doit etre confirmee.
                  </div>

                  {loadingTransferCandidates ? (
                    <div className="text-xs text-amber-700/90 mb-3">Chargement des membres eligibles...</div>
                  ) : transferCandidates.length === 0 ? (
                    <div className="text-xs text-amber-700/90 mb-3">
                      Aucun membre eligible pour recevoir la propriete.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <select
                        value={transferTargetId}
                        onChange={(e) => setTransferTargetId(e.target.value)}
                        className="h-11 w-full rounded-xl border border-amber-200 bg-white/90 px-4 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      >
                        {transferCandidates.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {member.username} ({member.role})
                          </option>
                        ))}
                      </select>

                      <Button
                        onClick={onTransferOwnership}
                        disabled={
                          loadingTransferCandidates ||
                          loadingTransfer ||
                          !activeServerId ||
                          !transferTargetId
                        }
                        className="h-11 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 border-0 text-white shadow-lg"
                      >
                        {loadingTransfer ? "..." : "Transferer la propriete"}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Danger */}
              <div className="rounded-2xl border border-red-200/50 p-5 bg-red-50/30 hover:bg-red-50/50 transition-all duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="text-sm font-bold text-red-700">
                    {isOwner ? "Zone dangereuse" : "Quitter le serveur"}
                  </div>
                </div>
                <div className="text-xs text-red-600/80 mb-4">
                  {isOwner
                    ? "La suppression est definitive et irreversible."
                    : "Tu peux quitter ce serveur a tout moment."}
                </div>

                <Button
                  variant={isOwner ? "destructive" : "outline"}
                  onClick={onLeaveOrDelete}
                  disabled={loadingDanger || !activeServerId}
                  className={isOwner ? "h-11 px-5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-0 shadow-lg" : "h-11 px-5 rounded-xl border-red-300 text-red-600 hover:bg-red-50"}
                >
                  {loadingDanger ? "..." : isOwner ? "Supprimer definitivement" : "Quitter"}
                </Button>
              </div>

              {status && (
                <div className={`text-xs border rounded-xl px-4 py-3 ${statusClasses}`}>
                  {status.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={openDangerConfirm}
        onOpenChange={setOpenDangerConfirm}
        title={isOwner ? "Supprimer ce serveur ?" : "Quitter ce serveur ?"}
        description={
          isOwner
            ? "Le serveur et ses données associées seront supprimés définitivement."
            : "Vous serez retiré de ce serveur."
        }
        confirmLabel={isOwner ? "Supprimer" : "Quitter"}
        confirmVariant={isOwner ? "destructive" : "default"}
        loading={loadingDanger}
        onConfirm={confirmLeaveOrDelete}
      />

      <ConfirmActionDialog
        open={openRevokeInviteConfirm}
        onOpenChange={setOpenRevokeInviteConfirm}
        title="Revoquer cette invitation ?"
        description={
          pendingRevokeInviteCode
            ? `Le code ${pendingRevokeInviteCode} sera desactive immediatement.`
            : "Cette invitation sera desactivee immediatement."
        }
        confirmLabel="Revoquer"
        confirmVariant="destructive"
        loading={loadingRevokeInviteCode === pendingRevokeInviteCode}
        onConfirm={confirmRevokeInvite}
      />

      <ConfirmActionDialog
        open={openTransferConfirm}
        onOpenChange={setOpenTransferConfirm}
        title="Transferer la propriete du serveur ?"
        description={
          selectedTransferMember
            ? `Le nouveau proprietaire sera ${selectedTransferMember.username}. Cette action est irreversible depuis cette interface.`
            : "Confirme le transfert de propriete."
        }
        confirmLabel="Confirmer le transfert"
        confirmVariant="default"
        loading={loadingTransfer}
        onConfirm={confirmTransferOwnership}
      />

      {/* Modal creation serveur */}
      <CreateServerModal
        open={openCreateServer}
        onOpenChange={setOpenCreateServer}
        onSuccess={onRefresh}
      />

      {/* Modal creation channel */}
      <CreateChannelModal
        open={openCreateChannel}
        onOpenChange={setOpenCreateChannel}
        serverId={activeServerId}
        onSuccess={handleChannelCreated}
      />
    </aside>
  );
}