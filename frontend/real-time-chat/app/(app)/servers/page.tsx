"use client";

import { useState, useEffect } from "react";
import { ServersLoader } from "./components/servers-loader";
import { ServersRail } from "./components/servers-rail";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { ServerSettingsModal } from "@/components/forms/server-settings-modal";
import { Menu, Users, X } from "lucide-react";

type MobileView = "sidebar" | "chat" | "members";

export default function ServersPage() {
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [isDesktop, setIsDesktop] = useState(false);
  const [openServerSettings, setOpenServerSettings] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <ServersLoader>
      {({ refresh }) => (
        <div className="h-full w-full flex gap-2 p-2 bg-et-bg overflow-hidden relative">
          {!isDesktop && (
            <div className="fixed top-0 left-0 right-0 z-30 h-12 bg-[var(--card)] border-b flex items-center justify-between px-3">
              <button
                onClick={() => setMobileView(mobileView === "sidebar" ? "chat" : "sidebar")}
                className="p-2 rounded-lg hover:bg-[var(--surface)]"
              >
                {mobileView === "sidebar" ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <span className="text-sm font-semibold">EpiTalk</span>
              <button
                onClick={() => setMobileView(mobileView === "members" ? "chat" : "members")}
                className="p-2 rounded-lg hover:bg-[var(--surface)]"
              >
                {mobileView === "members" ? <X className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </button>
            </div>
          )}

          {isDesktop && (
            <div className="h-full rounded-xl border border-et-border bg-et-card overflow-hidden shrink-0">
              <ServersRail onRefresh={refresh} />
            </div>
          )}

          {(isDesktop || mobileView === "sidebar") && (
            <div
              className={
                isDesktop
                  ? "h-full w-50 shrink-0 rounded-xl border border-et-border bg-et-card overflow-hidden"
                  : "fixed inset-0 z-20 pt-12 bg-white overflow-hidden"
              }
            >
              {!isDesktop && (
                <div className="border-b p-2">
                  <ServersRail onRefresh={refresh} />
                </div>
              )}
              <ChannelsSidebar
                onOpenSettings={() => setOpenServerSettings(true)}
              />
            </div>
          )}

          <ServerSettingsModal
            open={openServerSettings}
            onOpenChange={setOpenServerSettings}
            onSuccess={refresh}
          />

          {(isDesktop || mobileView === "chat") && (
            <div
              className={`flex-1 min-w-0 h-full rounded-xl border border-et-border bg-et-card overflow-hidden${
                !isDesktop ? " pt-12" : ""
              }`}
            >
              <ChatPanel />
            </div>
          )}

          {(isDesktop || mobileView === "members") && (
            <div
              className={
                isDesktop
                  ? "h-full w-55 shrink-0 rounded-xl border border-et-border bg-et-card overflow-hidden"
                  : "fixed inset-0 z-20 pt-12 bg-white overflow-hidden"
              }
            >
              <MembersPanel onRefresh={refresh} />
            </div>
          )}
        </div>
      )}
    </ServersLoader>
  );
}
