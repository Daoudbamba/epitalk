"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { CreateServerModal } from "@/components/forms/create-server-modal";
import { serversApi } from "@/lib/api";

export function KickModal() {
  const router = useRouter();
  const kickModal = useServerStore((s) => s.kickModal);
  const closeKickModal = useServerStore((s) => s.closeKickModal);
  const setServers = useServerStore((s) => s.setServers);
  const [joinOpen, setJoinOpen] = useState(false);

  if (!kickModal) return null;

  const { serverName, reason } = kickModal;

  const handleClose = () => {
    closeKickModal();
    const { servers, setActiveServer } = useServerStore.getState();
    if (servers.length > 0) {
      setActiveServer(servers[0].id);
      router.push("/servers");
    } else {
      router.push("/dm");
    }
  };

  const handleJoinSuccess = async () => {
    try {
      const updated = await serversApi.list();
      setServers(updated);
    } catch {
      // silently ignore refresh failure
    }
    setJoinOpen(false);
    closeKickModal();
    router.push("/servers");
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        style={{ pointerEvents: "auto" }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex">
          {/* Gray left rail */}
          <div className="w-1.5 shrink-0 bg-[#8A929C]" />

          {/* Content */}
          <div className="flex-1 px-7 py-6 flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0F1F3] flex items-center justify-center shrink-0">
                <LogOut size={20} className="text-[#8A929C]" />
              </div>
              <div>
                <div className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-[0.06em] bg-[#F0F1F3] text-[#8A929C] mb-1">
                  EXPULSION
                </div>
                <p className="text-[15px] font-semibold text-[#1A1D23] leading-snug">
                  Vous avez été expulsé de{" "}
                  <span className="text-[#333333]">{serverName}</span>
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#ECEEF1]" />

            {/* Rows */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
                  MOTIF
                </span>
                <span className="text-[14px] text-[#1A1D23]">
                  {reason && reason.trim() ? reason : "Aucun motif précisé"}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
                  À SAVOIR
                </span>
                <span className="text-[14px] text-[#555C66]">
                  Contrairement à un ban, une expulsion ne vous empêche pas de
                  rejoindre à nouveau ce serveur via un lien d&apos;invitation.
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#ECEEF1]" />

            {/* Footer */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 h-10 rounded-lg border border-[#D5DAE0] bg-white text-[#333333] text-[14px] font-medium hover:bg-[#F5F7FA] transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => setJoinOpen(true)}
                className="flex-1 h-10 rounded-lg bg-[#0066CC] text-white text-[14px] font-semibold hover:bg-[#0052A3] transition-colors"
              >
                Rejoindre avec un code
              </button>
            </div>
          </div>
        </div>
      </div>

      <CreateServerModal
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onSuccess={handleJoinSuccess}
      />
    </>
  );
}
