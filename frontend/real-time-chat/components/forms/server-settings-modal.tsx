"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { serversApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

interface ServerSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function ServerSettingsModal({ open, onOpenChange, onSuccess }: ServerSettingsModalProps) {
  const activeServerId = useServerStore((s) => s.activeServerId);
  const servers = useServerStore((s) => s.servers);
  const currentUser = useAuthStore((s) => s.user);
  const members = useMemberStore((s) => s.members);

  const server = servers.find((s) => s.id === activeServerId) ?? null;
  const isOwner = !!server && !!currentUser && server.owner_id === currentUser.id;
  const currentUserRole = members.find((m) => m.user_id === currentUser?.id)?.role;
  const canInvite = isOwner || currentUserRole === "Admin" || currentUserRole === "Moderator";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [loadingDanger, setLoadingDanger] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const handleClose = () => {
    if (loadingInvite || loadingDanger) return;
    setInviteLink(null);
    setInviteEmail("");
    setError(null);
    setConfirmDelete(false);
    onOpenChange(false);
  };

  const handleGenerateInvite = async () => {
    if (!activeServerId) return;
    setLoadingInvite(true);
    setError(null);
    try {
      const invite = await serversApi.createInvite(activeServerId);
      const link = `${window.location.origin}/invite/${invite.code}`;
      setInviteLink(link);
      await navigator.clipboard.writeText(link).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingInvite(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) {
      await handleGenerateInvite();
      return;
    }
    await navigator.clipboard.writeText(inviteLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!activeServerId || !isOwner) return;
    setLoadingDanger(true);
    setError(null);
    try {
      await serversApi.delete(activeServerId);
      await onSuccess();
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoadingDanger(false);
    }
  };

  const handleLeave = async () => {
    if (!activeServerId) return;
    setLoadingDanger(true);
    setError(null);
    try {
      await serversApi.leave(activeServerId);
      await onSuccess();
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoadingDanger(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadingInvite, loadingDanger]);

  if (!open || !server) return null;

  const memberCount = server.member_count ?? members.length;
  const serverId = server.id.slice(0, 8);
  const createdAt = formatDate(server.created_at);

  return createPortal(
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-lg shadow-xl p-6 max-h-[90vh] overflow-y-auto">

        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={loadingInvite || loadingDanger}
          className="absolute top-4 right-4 w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-[#0066CC] text-white flex items-center justify-center font-mono text-[18px] font-semibold shrink-0 select-none">
            {initials(server.name)}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
              PARAMÈTRES DU SERVEUR
            </p>
            <h2 className="text-[20px] font-semibold text-[#003D82] leading-tight truncate">
              {server.name}
            </h2>
            <p className="text-[12px] font-mono text-[#8A929C]">
              {memberCount} membres · créé le {createdAt} · ID {serverId}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="border-b border-[#D5DAE0] mt-4 mb-5" />

        {error && <p className="text-[11px] text-red-500 mb-4">{error}</p>}

        {/* Section — Inviter un membre */}
        {canInvite && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-[#333333]">
              {isEnglish ? "Invite a member" : "Inviter un membre"}
            </span>
            <span className="text-[12px] font-mono text-[#8A929C]">
              {isEnglish ? "Epitech login or email" : "login Epitech ou email"}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="prenom.nom@epitech.eu"
              className="flex-1 h-10 px-3 rounded border border-[#D5DAE0] text-[14px] text-[#333333] placeholder:text-[#8A929C] focus:outline-none focus:border-[#0066CC] transition-colors"
            />
            <button
              onClick={() => { setInviteEmail(""); }}
              className="px-8 h-10 rounded bg-[#0066CC] text-white text-[14px] font-medium hover:bg-[#0055AA] transition-colors shrink-0"
            >
              {isEnglish ? "Invite" : "Inviter"}
            </button>
          </div>
        </div>
        )}

        {/* Section — Lien d'invitation */}
        {canInvite && (
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-[#333333]">
              {isEnglish ? "Invite link" : "Lien d'invitation"}
            </span>
            <span className="text-[12px] text-[#8A929C]">
              {isEnglish ? "expires in 7 days" : "expire dans 7 jours"}
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            {/* Link display */}
            <div
              onClick={handleCopyLink}
              className="flex-1 h-10 px-3 rounded border border-[#D5DAE0] bg-[#FAFBFC] flex items-center cursor-pointer hover:bg-[#F0F4F8] transition-colors overflow-hidden"
            >
              {inviteLink ? (
                <span className="text-[14px] font-mono text-[#333333] truncate">
                  {inviteLink}
                </span>
              ) : (
                <span className="text-[14px] font-mono text-[#8A929C]">
                  epitalk.io/ —
                </span>
              )}
            </div>
            <button
              onClick={handleCopyLink}
              disabled={loadingInvite}
              className="px-8 h-10 rounded border border-[#D5DAE0] bg-white text-[#333333] text-[14px] font-medium hover:bg-[#F5F7FA] transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingInvite
                ? "..."
                : copied
                  ? (isEnglish ? "Copied!" : "Copié !")
                  : (isEnglish ? "Copy" : "Copier")}
            </button>
          </div>
        </div>
        )}

        {/* Danger zone — delete / leave */}
        <div className="mt-8 pt-5 border-t border-[#D5DAE0]">
          {confirmDelete ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[12px] text-[#6B737D] text-center">
                {isEnglish
                  ? "Are you sure? This cannot be undone."
                  : "Confirmer la suppression ? Cette action est irréversible."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 h-9 rounded border border-[#D5DAE0] text-[#333333] text-[13px] hover:bg-[#F5F7FA] transition-colors"
                >
                  {isEnglish ? "Cancel" : "Annuler"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loadingDanger}
                  className="px-4 h-9 rounded border border-red-400 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {loadingDanger ? "..." : (isEnglish ? "Delete permanently" : "Supprimer définitivement")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={isOwner ? () => setConfirmDelete(true) : handleLeave}
                disabled={loadingDanger}
                className="px-6 h-9 rounded border border-red-300 text-red-500 text-[13px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isOwner
                  ? (isEnglish ? "Delete this server" : "Supprimer ce serveur")
                  : (isEnglish ? "Leave this server" : "Quitter ce serveur")}
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
