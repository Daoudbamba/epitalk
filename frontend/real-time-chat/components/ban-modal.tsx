"use client";

import { useRouter } from "next/navigation";
import { Clock, ShieldX } from "lucide-react";
import { useServerStore } from "@/store/server.store";

function formatExpiration(expiresAt: string): string {
  try {
    const d = new Date(expiresAt);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return expiresAt;
  }
}

export function BanModal() {
  const router = useRouter();
  const banModal = useServerStore((s) => s.banModal);
  const closeBanModal = useServerStore((s) => s.closeBanModal);

  if (!banModal) return null;

  const { serverName, expiresAt, reason } = banModal;
  const isTemp = !!expiresAt;

  const railColor = isTemp ? "#FF6B35" : "#D93F3F";
  const badgeBg = isTemp ? "bg-[#FFF0E8]" : "bg-[#FDEAEA]";
  const badgeText = isTemp ? "text-[#FF6B35]" : "text-[#D93F3F]";
  const badgeLabel = isTemp ? "BANNISSEMENT TEMPORAIRE" : "BANNISSEMENT PERMANENT";

  const handleClose = () => {
    closeBanModal();
    const { servers, setActiveServer } = useServerStore.getState();
    if (servers.length > 0) {
      setActiveServer(servers[0].id);
      router.push("/servers");
    } else {
      router.push("/dm");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex">
        {/* Colored left rail */}
        <div
          className="w-1.5 shrink-0"
          style={{ backgroundColor: railColor }}
        />

        {/* Content */}
        <div className="flex-1 px-7 py-6 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: isTemp ? "#FFF0E8" : "#FDEAEA" }}
            >
              {isTemp ? (
                <Clock size={20} style={{ color: railColor }} />
              ) : (
                <ShieldX size={20} style={{ color: railColor }} />
              )}
            </div>
            <div>
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-[0.06em] ${badgeBg} ${badgeText} mb-1`}>
                {badgeLabel}
              </div>
              <p className="text-[15px] font-semibold text-[#1A1D23] leading-snug">
                Vous avez été exclu de{" "}
                <span style={{ color: railColor }}>{serverName}</span>
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#ECEEF1]" />

          {/* Rows */}
          <div className="flex flex-col gap-4">
            {isTemp && expiresAt && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
                  EXPIRATION
                </span>
                <span className="text-[14px] text-[#1A1D23] font-medium">
                  {formatExpiration(expiresAt)}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
                MOTIF
              </span>
              <span className="text-[14px] text-[#1A1D23]">
                {reason && reason.trim() ? reason : "Aucun motif précisé"}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#ECEEF1]" />

          {/* Footer */}
          <button
            onClick={handleClose}
            className="w-full h-10 rounded-lg text-white text-[14px] font-semibold transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: railColor }}
          >
            Fermer le message
          </button>
        </div>
      </div>
    </div>
  );
}
