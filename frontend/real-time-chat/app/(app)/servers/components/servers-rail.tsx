"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
    <aside className="w-18 h-full flex flex-col items-center py-3 gap-2">
      {/* EPITALK logo */}
      <div className="mb-1 flex items-center justify-center h-8">
        <span className="text-[11px] font-bold italic tracking-[0.04em] text-et-gradient select-none">
          EPITALK
        </span>
      </div>

      {/* Add server button */}
      <button
        onClick={() => setOpenCreateServer(true)}
        className="w-10.5 h-10.5 rounded-full border-[1.5px] border-et-orange flex items-center justify-center text-et-orange hover:bg-orange-50 transition-colors shrink-0"
        title={isEnglish ? "Create a server" : "Créer un serveur"}
      >
        <i className="bi bi-plus-lg text-[16px]" />
      </button>

      {/* DM button */}
      <Link
        href="/dm"
        className="w-10.5 h-10.5 rounded-full bg-et-avatar-empty flex items-center justify-center text-et-muted hover:bg-et-border-input transition-colors shrink-0"
        title={isEnglish ? "Direct messages" : "Messages privés"}
      >
        <i className="bi bi-chat-dots text-[15px]" />
      </Link>

      {/* Servers list */}
      <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-auto py-1 px-3.75">
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
                "w-10.5 h-10.5 rounded-full flex items-center justify-center font-semibold text-sm shrink-0",
                active
                  ? "border-et-gradient text-et-orange"
                  : "bg-et-avatar-empty text-et-text",
              ].join(" ")}
              title={s.name}
            >
              {initials(s.name)}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <hr className="w-[60%] border-et-border my-1" />

      {/* User Settings (avatar) */}
      <div className="shrink-0">
        <UserSettings />
      </div>

      {/* Desktop app button */}
      {!isElectron && (
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            onClick={openDesktopApp}
            title={isEnglish ? "Open desktop app" : "Ouvrir l'app desktop"}
            className="w-10.5 h-10.5 rounded-full bg-et-avatar-empty flex items-center justify-center text-et-muted hover:bg-et-border-input transition-colors"
          >
            <i className="bi bi-display text-[15px]" />
          </button>
          {desktopFallback && (
            <a
              href="https://github.com/EpitechMscProPromo2028/T-DEV-600-PAR_20/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="text-[9px] text-center text-et-orange underline leading-tight w-14 hover:opacity-70"
            >
              {isEnglish ? "Download" : "Télécharger"}
            </a>
          )}
        </div>
      )}

      {/* Create / Join server modal */}
      <CreateServerModal
        open={openCreateServer}
        onOpenChange={setOpenCreateServer}
        onSuccess={onRefresh}
      />
    </aside>
  );
}
