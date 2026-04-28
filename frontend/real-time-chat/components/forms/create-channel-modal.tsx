"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { channelsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";

interface CreateChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string | null;
  onSuccess: () => Promise<void>;
}

export function CreateChannelModal({ open, onOpenChange, serverId, onSuccess }: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/35" onClick={handleClose} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-90 max-w-[calc(100vw-32px)] bg-white rounded-2xl p-6 shadow-lg">

        {/* Informative header — shows live channel name preview */}
        <p className="text-center text-[13px] font-medium uppercase tracking-wide text-et-muted mb-5">
          {name.trim() || (isEnglish ? "CHANNEL NAME" : "NOM CHANNEL")}
        </p>

        {/* Section */}
        <p className="text-[14px] font-medium text-et-title mb-0.5">
          {isEnglish ? "Create a new channel" : "Créer un nouvel channel"}
        </p>
        <p className="text-[12px] text-et-muted mb-4">
          {isEnglish
            ? "Channels are discussion spaces within your server."
            : "Les channels sont des espaces de discussion au sein de votre serveur."}
        </p>

        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            setError(null);
          }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={isEnglish ? "channel-name" : "nom-du-channel"}
          disabled={loading}
          autoFocus
          className={[
            "w-full h-9 px-3 text-[13px] rounded-lg border bg-white text-et-text placeholder:text-et-muted focus:outline-none focus:border-et-orange transition-colors",
            shake ? "shake border-et-red-soft" : "border-et-border-input",
          ].join(" ")}
        />
        {error && <p className="text-[11px] text-et-red-soft mt-1.5">{error}</p>}

        {/* Buttons */}
        <div className="flex gap-3 justify-center mt-5">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-6 py-2 rounded-lg border border-et-red-soft text-et-red-soft text-[13px] font-medium hover:bg-red-50/50 transition-colors disabled:opacity-50"
          >
            {isEnglish ? "Cancel" : "Annuler"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="px-6 py-2 rounded-lg border border-et-orange text-et-orange text-[13px] font-medium hover:bg-orange-50/50 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : isEnglish ? "Create" : "Créer"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
