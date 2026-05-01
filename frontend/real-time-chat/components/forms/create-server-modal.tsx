"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Edit3 } from "lucide-react";
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
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
      const server = await serversApi.create(trimmed);
      if (avatarFile) {
        try {
          await serversApi.uploadAvatar(server.id, avatarFile);
        } catch {
          // Avatar upload failure is non-blocking — server is still created
        }
      }
      await onSuccess();
      setCreateName("");
      setAvatarFile(null);
      setAvatarPreview(null);
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
    setAvatarFile(null);
    setAvatarPreview(null);
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
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-lg shadow-xl p-6 font-sans max-h-[90vh] overflow-y-auto">

        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={loadingCreate || loadingJoin}
          className="absolute top-4 right-4 w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Avatar upload */}
        <div className="flex justify-center">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full bg-[#DCE9F8] hover:bg-[#C5D9F2] flex items-center justify-center transition-colors overflow-hidden cursor-pointer"
              style={avatarPreview ? { backgroundImage: `url(${avatarPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {!avatarPreview && <Plus className="w-6 h-6 text-[#003D82]" />}
            </button>
            <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-[#0066CC] text-white flex items-center justify-center">
              <Edit3 className="w-3.5 h-3.5" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Pre-title */}
        <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mt-4 text-center">
          NOUVEAU SERVEUR
        </p>

        {/* Title */}
        <h2 className="text-[20px] font-semibold text-[#003D82] mt-1 text-center">
          {isEnglish ? "Join or create a server" : "Rejoindre ou créer un serveur"}
        </h2>

        {/* Section — Créer */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-[#333333]">
              {isEnglish ? "Create a server" : "Créer un serveur"}
            </span>
            <span className="text-[12px] text-[#8A929C]">
              {isEnglish ? "You will be creator" : "Vous serez créateur"}
            </span>
          </div>
          <p className="text-[13px] text-[#6B737D] mt-1">
            {isEnglish
              ? "Create your own space and invite your classmates."
              : "Créez votre propre espace et invitez vos camarades de promo."}
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={createName}
              onChange={(e) => { setCreateName(e.target.value); setCreateError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder={isEnglish ? "Server name — e.g. Promo 2027" : "Nom du serveur — ex. Promo 2027"}
              disabled={loadingCreate}
              autoFocus
              className={[
                "flex-1 h-10 px-3 rounded border text-[14px] bg-white text-[#333333] placeholder:text-[#8A929C] focus:outline-none focus:border-[#0066CC] transition-colors",
                shakeCreate ? "shake border-red-400" : "border-[#D5DAE0]",
              ].join(" ")}
            />
            <button
              onClick={handleCreate}
              disabled={loadingCreate}
              className="px-6 h-10 rounded bg-[#0066CC] text-white text-[14px] font-medium hover:bg-[#0055AA] transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingCreate ? "..." : isEnglish ? "Create" : "Créer"}
            </button>
          </div>
          {createError && <p className="text-[11px] text-red-500 mt-1.5">{createError}</p>}
        </div>

        {/* Separator */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E1E5EA]" />
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">ou</span>
          <div className="flex-1 h-px bg-[#E1E5EA]" />
        </div>

        {/* Section — Rejoindre */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-[#333333]">
              {isEnglish ? "Join a server" : "Rejoindre un serveur"}
            </span>
            <span className="text-[12px] text-[#8A929C]">
              {isEnglish ? "Invite code" : "Code d'invitation"}
            </span>
          </div>
          <p className="text-[13px] text-[#6B737D] mt-1">
            {isEnglish
              ? "Paste a code (6 characters) or a full invite link."
              : "Collez un code (6 caractères) ou un lien complet d'invitation."}
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              placeholder="epitalk.io/ GEPI-2027"
              disabled={loadingJoin}
              className={[
                "flex-1 h-10 px-3 rounded border text-[14px] bg-white text-[#333333] placeholder:text-[#8A929C] focus:outline-none focus:border-[#0066CC] transition-colors",
                shakeJoin ? "shake border-red-400" : "border-[#D5DAE0]",
              ].join(" ")}
            />
            <button
              onClick={handleJoin}
              disabled={loadingJoin}
              className="px-6 h-10 rounded bg-[#0066CC] text-white text-[14px] font-medium hover:bg-[#0055AA] transition-colors disabled:opacity-50 shrink-0"
            >
              {loadingJoin ? "..." : isEnglish ? "Join" : "Rejoindre"}
            </button>
          </div>
          {joinError && <p className="text-[11px] text-red-500 mt-1.5">{joinError}</p>}
        </div>

        {/* Cancel */}
        <button
          onClick={handleClose}
          disabled={loadingCreate || loadingJoin}
          className="mt-6 w-full h-10 rounded border border-[#D5DAE0] bg-white text-[#333333] text-[14px] font-medium hover:bg-[#F5F7FA] transition-colors disabled:opacity-50"
        >
          {isEnglish ? "Cancel" : "Annuler"}
        </button>
      </div>
    </>,
    document.body
  );
}
