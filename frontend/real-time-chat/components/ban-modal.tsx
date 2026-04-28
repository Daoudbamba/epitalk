"use client";

import { useRouter } from "next/navigation";
import { useServerStore } from "@/store/server.store";

function formatBanDuration(expiresAt: string): string {
  const now = Date.now();
  const expMs = new Date(expiresAt).getTime();
  const diffMs = expMs - now;

  if (diffMs <= 0) return "expiré";

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) return `${diffDays} jour${diffDays > 1 ? "s" : ""}`;
  if (diffHours >= 1) return `${diffHours} heure${diffHours > 1 ? "s" : ""}`;
  return `${diffMins} minute${diffMins > 1 ? "s" : ""}`;
}

export function BanModal() {
  const router = useRouter();
  const banModal = useServerStore((s) => s.banModal);
  const closeBanModal = useServerStore((s) => s.closeBanModal);

  if (!banModal) return null;

  const { serverName, expiresAt, reason } = banModal;

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8 flex flex-col gap-5">
        <h2 className="text-xl font-semibold text-white">
          Vous avez été banni de{" "}
          <span className="text-red-400">{serverName}</span>
        </h2>

        <p className="text-sm text-zinc-400">
          {expiresAt ? (
            <>
              Ban temporaire — expire dans{" "}
              <span className="text-zinc-200 font-medium">
                {formatBanDuration(expiresAt)}
              </span>
            </>
          ) : (
            <span className="text-red-300 font-medium">Ban définitif</span>
          )}
        </p>

        <p className="text-sm text-zinc-400">
          Motif :{" "}
          <span className="text-zinc-200">
            {reason && reason.trim() ? reason : "Motif non précisé"}
          </span>
        </p>

        <button
          onClick={handleClose}
          className="mt-2 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium py-2.5 transition-colors"
        >
          Fermer le message
        </button>
      </div>
    </div>
  );
}
