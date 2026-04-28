"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { serversApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
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

  const server = servers.find((s) => s.id === activeServerId) ?? null;
  const isOwner = !!server && !!currentUser && server.owner_id === currentUser.id;

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
    if (!inviteLink) return;
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

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/35" onClick={handleClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-90 max-w-[calc(100vw-32px)] bg-white rounded-2xl p-6 shadow-lg max-h-[90vh] overflow-y-auto">

        {/* Server avatar + name */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-16 h-16 group mb-3">
            <div className="w-16 h-16 rounded-full bg-et-gradient flex items-center justify-center text-white font-bold text-lg select-none">
              {initials(server.name)}
            </div>
            {isOwner && (
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white border border-et-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                <i className="bi bi-pencil text-[9px] text-et-secondary" />
              </div>
            )}
          </div>
          <p className="text-[14px] font-medium uppercase tracking-wide text-et-title">
            {server.name}
          </p>
        </div>

        {/* Section — Invite */}
        <div className="mb-6">
          <p className="text-[14px] font-medium text-et-title mb-0.5">
            {isEnglish ? "Invite to my server" : "Inviter sur mon serveur"}
          </p>
          <p className="text-[12px] text-et-muted mb-3">
            {isEnglish
              ? "Create your own server and invite your friends"
              : "Créer votre propre serveur et invitez vos amis"}
          </p>
          <div className="flex gap-2">
            <input
              value={inviteLink ?? ""}
              readOnly
              onClick={inviteLink ? handleCopyLink : undefined}
              placeholder={isEnglish ? "Generate a link..." : "Générer un lien..."}
              className="flex-1 min-w-0 h-9 px-3 text-[12px] rounded-lg border border-et-border-input bg-et-bg text-et-text placeholder:text-et-muted focus:outline-none cursor-pointer truncate"
            />
            <button
              onClick={handleGenerateInvite}
              disabled={loadingInvite}
              className="h-9 px-3 rounded-lg border border-et-orange text-et-orange text-[13px] font-medium hover:bg-orange-50/50 transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingInvite ? "..." : isEnglish ? "Generate" : "Générer"}
            </button>
          </div>
          {inviteLink && (
            <p className="text-[11px] mt-1.5 transition-colors" style={{ color: copied ? "#f97316" : "#9ca3af" }}>
              {copied
                ? (isEnglish ? "Copied!" : "Copié !")
                : (isEnglish ? "Click the field to copy" : "Cliquez le champ pour copier")}
            </p>
          )}
        </div>

        {error && <p className="text-[11px] text-et-red-soft mb-4">{error}</p>}

        {/* Delete / Leave */}
        <div className="flex justify-center">
          {confirmDelete ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="text-[12px] text-et-secondary text-center">
                {isEnglish
                  ? "Are you sure? This cannot be undone."
                  : "Confirmer la suppression ? Cette action est irréversible."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-2 rounded-lg border border-et-border text-et-secondary text-[13px] hover:bg-et-bg transition-colors"
                >
                  {isEnglish ? "Cancel" : "Annuler"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loadingDanger}
                  className="px-4 py-2 rounded-lg border border-et-red-soft text-et-red-soft text-[13px] font-medium hover:bg-red-50/50 transition-colors disabled:opacity-50"
                >
                  {loadingDanger ? "..." : isEnglish ? "Delete permanently" : "Supprimer définitivement"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={isOwner ? () => setConfirmDelete(true) : handleLeave}
              disabled={loadingDanger}
              className="px-8 py-2 rounded-lg border border-et-red-soft text-et-red-soft text-[13px] font-medium hover:bg-red-50/50 transition-colors disabled:opacity-50"
            >
              {isOwner
                ? (isEnglish ? "Delete this server" : "Supprimer ce serveur")
                : (isEnglish ? "Leave this server" : "Quitter ce serveur")}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
