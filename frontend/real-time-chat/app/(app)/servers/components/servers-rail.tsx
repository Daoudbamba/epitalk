"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Monitor, Plus, MessageCircle } from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { UserSettings } from "./user-settings";
import { CreateServerModal } from "@/components/forms/create-server-modal";
import { useLanguage } from "@/components/language-provider";

function initials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "NS";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "N";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "S";
  return (first + second).toUpperCase();
}

export function ServersRail({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const servers = useServerStore((s) =>
    Array.isArray(s.servers) ? s.servers : [],
  );
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);
  const resetChannels = useChannelStore((s) => s.reset);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const [openCreateServer, setOpenCreateServer] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [desktopFallback, setDesktopFallback] = useState(false);

  useEffect(() => {
    setIsElectron(!!(window as unknown as Record<string, unknown>).__ELECTRON__);
  }, []);

  const openDesktopApp = () => {
    setDesktopFallback(false);
    window.open("epitalk://open", "_self");
    const t = setTimeout(() => setDesktopFallback(true), 2000);
    window.addEventListener("blur", () => clearTimeout(t), { once: true });
  };

  return (
    <aside className="w-22 h-full flex flex-col items-center py-4 bg-[#003D82]">
      {/* Logo */}
      <div className="h-8 flex items-center justify-center mb-4">
        <span className="text-[11px] font-bold italic tracking-[0.04em] text-white select-none">
          EPITALK
        </span>
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-[rgba(255,255,255,0.12)] mb-3" />

      {/* Servers list */}
      <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-auto px-4.5 py-1">
        {servers.map((s) => {
          const active = s.id === activeServerId;
          return (
            <button
              key={s.id}
              onClick={() => {
                if (s.id !== activeServerId) resetChannels();
                setActiveServer(s.id);
              }}
              className={[
                "relative w-11 h-11 rounded-lg flex items-center justify-center font-semibold text-sm shrink-0 transition-colors duration-120",
                active
                  ? "bg-[#0066CC] text-white"
                  : "bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.16)]",
              ].join(" ")}
              title={s.name}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
              )}
              {initials(s.name)}
            </button>
          );
        })}

        {/* Add server button */}
        <button
          onClick={() => setOpenCreateServer(true)}
          className="w-11 h-11 rounded-lg border border-dashed border-[rgba(255,255,255,0.25)] flex items-center justify-center text-[rgba(255,255,255,0.6)] hover:border-white hover:text-white transition-colors duration-120 shrink-0"
          title={isEnglish ? "Create a server" : "Créer un serveur"}
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Divider */}
      <div className="w-8 h-px bg-[rgba(255,255,255,0.12)] my-2" />

      {/* DM link */}
      <Link
        href="/dm"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-colors duration-120 shrink-0 mb-2"
        title={isEnglish ? "Direct messages" : "Messages privés"}
      >
        <MessageCircle size={18} />
      </Link>

      {/* Desktop app button */}
      {!isElectron && (
        <div className="flex flex-col items-center gap-1 shrink-0 mb-2">
          <button
            onClick={openDesktopApp}
            title={isEnglish ? "Open desktop app" : "Ouvrir l'app desktop"}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-colors duration-120"
          >
            <Monitor size={18} />
          </button>
          {desktopFallback && (
            <a
              href="https://github.com/EpitechMscProPromo2028/T-DEV-600-PAR_20/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-center text-[rgba(255,255,255,0.5)] underline leading-tight w-14 hover:opacity-70"
            >
              {isEnglish ? "Download" : "Télécharger"}
            </a>
          )}
        </div>
      )}

      {/* User Settings (avatar) */}
      <div className="shrink-0">
        <UserSettings />
      </div>

      {/* Create / Join server modal */}
      <CreateServerModal
        open={openCreateServer}
        onOpenChange={setOpenCreateServer}
        onSuccess={onRefresh}
      />
    </aside>
  );
}
