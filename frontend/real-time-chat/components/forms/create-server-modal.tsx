"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { serversApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";

function extractInviteCode(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const match = v.match(/\/invite\/([^/?#\s]+)/i);
  if (match?.[1]) return match[1].trim();
  const codeOnly = v.match(/^([a-z0-9_-]{4,64})$/i);
  if (codeOnly?.[1]) return codeOnly[1].trim();
  return null;
}

interface CreateServerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

export function CreateServerModal({ open, onOpenChange, onSuccess }: CreateServerModalProps) {
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [shakeCreate, setShakeCreate] = useState(false);
  const [shakeJoin, setShakeJoin] = useState(false);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const triggerShake = (which: "create" | "join") => {
    if (which === "create") {
      setShakeCreate(true);
      setTimeout(() => setShakeCreate(false), 400);
    } else {
      setShakeJoin(true);
      setTimeout(() => setShakeJoin(false), 400);
    }
  };

  const handleCreate = async () => {
    const trimmed = createName.trim();
    if (!trimmed) {
      triggerShake("create");
      setCreateError(isEnglish ? "Server name is required" : "Le nom est requis");
      return;
    }
    setLoadingCreate(true);
    setCreateError(null);
    try {
      await serversApi.create(trimmed);
      await onSuccess();
      setCreateName("");
      onOpenChange(false);
    } catch (err) {
      setCreateError(getErrorMessage(err));
    } finally {
      setLoadingCreate(false);
    }
  };

  const handleJoin = async () => {
    const code = extractInviteCode(joinCode);
    if (!code) {
      triggerShake("join");
      setJoinError(isEnglish ? "Paste a valid code or link" : "Colle un code ou lien valide");
      return;
    }
    setLoadingJoin(true);
    setJoinError(null);
    try {
      await serversApi.joinByInvite(code);
      await onSuccess();
      setJoinCode("");
      onOpenChange(false);
    } catch (err) {
      setJoinError(getErrorMessage(err));
    } finally {
      setLoadingJoin(false);
    }
  };

  const handleClose = () => {
    if (loadingCreate || loadingJoin) return;
    setCreateName("");
    setJoinCode("");
    setCreateError(null);
    setJoinError(null);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadingCreate, loadingJoin]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/35" onClick={handleClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-90 max-w-[calc(100vw-32px)] bg-white rounded-2xl p-6 shadow-lg">

        {/* Avatar placeholder */}
        <div className="flex justify-center mb-6">
          <div className="relative w-16 h-16 group">
            <div className="w-16 h-16 rounded-full bg-et-avatar-empty flex items-center justify-center">
              <i className="bi bi-image text-et-muted text-xl" />
            </div>
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white border border-et-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
              <i className="bi bi-pencil text-[9px] text-et-secondary" />
            </div>
          </div>
        </div>

        {/* Section — Créer */}
        <div className="mb-5">
          <p className="text-[14px] font-medium text-et-title mb-0.5">
            {isEnglish ? "Create a server" : "Créer un serveur"}
          </p>
          <p className="text-[12px] text-et-muted mb-3">
            {isEnglish
              ? "Create your own server and invite your friends"
              : "Créer votre propre serveur et invitez vos amis"}
          </p>
          <div className="flex gap-2">
            <input
              value={createName}
              onChange={(e) => { setCreateName(e.target.value); setCreateError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder={isEnglish ? "Server name..." : "Nom du serveur..."}
              disabled={loadingCreate}
              autoFocus
              className={[
                "flex-1 h-9 px-3 text-[13px] rounded-lg border bg-white text-et-text placeholder:text-et-muted focus:outline-none focus:border-et-orange transition-colors",
                shakeCreate ? "shake border-et-red-soft" : "border-et-border-input",
              ].join(" ")}
            />
            <button
              onClick={handleCreate}
              disabled={loadingCreate}
              className="h-9 px-3 rounded-lg border border-et-orange text-et-orange text-[13px] font-medium hover:bg-orange-50/50 transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingCreate ? "..." : isEnglish ? "Create" : "Créer"}
            </button>
          </div>
          {createError && <p className="text-[11px] text-et-red-soft mt-1.5">{createError}</p>}
        </div>

        <hr className="border-et-border mb-5" />

        {/* Section — Rejoindre */}
        <div className="mb-6">
          <p className="text-[14px] font-medium text-et-title mb-0.5">
            {isEnglish ? "Join a server" : "Rejoindre un serveur"}
          </p>
          <p className="text-[12px] text-et-muted mb-3">
            {isEnglish
              ? "Paste a code or full invite link."
              : "Colle un code ou un lien complet d'invitation."}
          </p>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              placeholder={isEnglish ? "Invite link or code..." : "Lien d'invite ou code..."}
              disabled={loadingJoin}
              className={[
                "flex-1 h-9 px-3 text-[13px] rounded-lg border bg-white text-et-text placeholder:text-et-muted focus:outline-none focus:border-et-orange transition-colors",
                shakeJoin ? "shake border-et-red-soft" : "border-et-border-input",
              ].join(" ")}
            />
            <button
              onClick={handleJoin}
              disabled={loadingJoin}
              className="h-9 px-3 rounded-lg border border-et-orange text-et-orange text-[13px] font-medium hover:bg-orange-50/50 transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingJoin ? "..." : isEnglish ? "Join" : "Rejoindre"}
            </button>
          </div>
          {joinError && <p className="text-[11px] text-et-red-soft mt-1.5">{joinError}</p>}
        </div>

        {/* Cancel */}
        <div className="flex justify-center">
          <button
            onClick={handleClose}
            disabled={loadingCreate || loadingJoin}
            className="px-8 py-2 rounded-lg border border-et-red-soft text-et-red-soft text-[13px] font-medium hover:bg-red-50/50 transition-colors disabled:opacity-50"
          >
            {isEnglish ? "Cancel" : "Annuler"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
