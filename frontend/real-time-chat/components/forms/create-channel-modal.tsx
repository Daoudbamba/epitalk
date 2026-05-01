"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Hash, Lock, Plus, X } from "lucide-react";
import { channelsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";

interface CreateChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string | null;
  onSuccess: () => Promise<void>;
  serverName?: string | null;
}

export function CreateChannelModal({
  open,
  onOpenChange,
  serverId,
  onSuccess,
  serverName,
}: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [channelType, setChannelType] = useState<"public" | "private">("public");
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSubmit = async () => {
    if (!serverId) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length < 2) {
      triggerShake();
      setError(isEnglish ? "At least 2 characters required" : "Minimum 2 caractères requis");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await channelsApi.create(serverId, trimmed);
      await onSuccess();
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setName("");
    setError(null);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  if (!open) return null;

  const pretitle = serverName
    ? serverName.toUpperCase()
    : isEnglish
      ? "SERVER"
      : "SERVEUR";

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 font-['IBM_Plex_Sans']"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 text-[#8A929C] hover:text-[#333333] transition-colors disabled:opacity-50"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2">
          {pretitle}
        </p>
        <h2 className="text-[20px] font-semibold text-[#003D82]">
          {isEnglish ? "Create a new channel" : "Créer un nouveau channel"}
        </h2>

        {/* Description */}
        <p className="mt-3 text-[13px] text-[#6B737D] leading-4.5">
          {isEnglish
            ? "Channels are themed discussion spaces within your server. Give them a short name, in kebab-case."
            : "Les channels sont des espaces de discussion thématiques au sein de votre serveur. Donnez-leur un nom court, en kebab-case."}
        </p>

        {/* Name field */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="text-[14px] font-medium text-[#333333]">
              {isEnglish ? "Channel name" : "Nom du channel"}
            </label>
            <span className="text-[12px] text-[#8A929C]">2-32 caractères</span>
          </div>
          <div
            className={[
              "mt-2 flex items-center gap-2 border rounded px-3 h-10 focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] transition-shadow",
              shake ? "border-red-400" : "border-[#0066CC]",
            ].join(" ")}
          >
            <Hash size={16} className="text-[#8A929C] shrink-0" />
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder={isEnglish ? "channel-name" : "module-c-pool"}
              disabled={loading}
              autoFocus
              className="flex-1 bg-transparent outline-none text-[14px] text-[#333333] placeholder:text-[#8A929C]"
            />
          </div>
          {error && (
            <p className="text-[11px] text-red-500 mt-1.5">{error}</p>
          )}
        </div>

        {/* Type selector */}
        <div className="mt-4">
          <label className="text-[14px] font-medium text-[#333333]">
            {isEnglish ? "Type" : "Type"}
          </label>
          <div className="mt-2 inline-flex border border-[#D5DAE0] rounded p-0.5 gap-0.5">
            <button
              onClick={() => setChannelType("public")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] transition-colors",
                channelType === "public"
                  ? "bg-white text-[#0066CC] font-medium shadow-sm"
                  : "text-[#6B737D] hover:text-[#333333]",
              ].join(" ")}
            >
              <Hash size={14} className="w-3.5 h-3.5" />
              {isEnglish ? "Public" : "Public"}
            </button>
            <button
              onClick={() => setChannelType("private")}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] transition-colors",
                channelType === "private"
                  ? "bg-white text-[#0066CC] font-medium shadow-sm"
                  : "text-[#6B737D] hover:text-[#333333]",
              ].join(" ")}
            >
              <Lock size={14} className="w-3.5 h-3.5" />
              {isEnglish ? "Private" : "Privé"}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-[#8A929C]">
            {channelType === "public"
              ? isEnglish
                ? "Visible to all server members."
                : "Visible par tous les membres du serveur."
              : isEnglish
                ? "Visible only to invited members."
                : "Visible uniquement par les membres invités."}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 h-10 rounded border border-[#D5DAE0] bg-white text-[#333333] text-[14px] font-medium hover:bg-[#F5F7FA] transition-colors disabled:opacity-50"
          >
            {isEnglish ? "Cancel" : "Annuler"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="flex-1 h-10 rounded bg-[#0066CC] text-white text-[14px] font-medium hover:bg-[#0055AA] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={16} className="w-4 h-4" />
            {loading
              ? "..."
              : isEnglish
                ? "Create channel"
                : "Créer le channel"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
