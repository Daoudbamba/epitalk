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
        <div className="h-screen w-screen overflow-hidden bg-[#FAFBFC] p-5">
          {/* Mobile top bar */}
          {!isDesktop && (
            <div className="fixed top-0 left-0 right-0 z-30 h-12 bg-white border-b border-[#D5DAE0] flex items-center justify-between px-3">
              <button
                onClick={() => setMobileView(mobileView === "sidebar" ? "chat" : "sidebar")}
                className="p-2 rounded-lg hover:bg-[#ECEEF1]"
              >
                {mobileView === "sidebar" ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <span className="text-sm font-semibold text-[#003D82]">EpiTalk</span>
              <button
                onClick={() => setMobileView(mobileView === "members" ? "chat" : "members")}
                className="p-2 rounded-lg hover:bg-[#ECEEF1]"
              >
                {mobileView === "members" ? <X className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </button>
            </div>
          )}

          {/* Desktop layout */}
          {isDesktop ? (
            <div className="flex h-full w-full gap-5">
              {/* Rail */}
              <div className="h-full w-22 shrink-0 rounded-xl border border-[#D5DAE0] overflow-hidden shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)]">
                <ServersRail onRefresh={refresh} />
              </div>

              {/* Channels */}
              <div className="h-full w-60 shrink-0 rounded-xl border border-[#D5DAE0] overflow-hidden shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)]">
                <ChannelsSidebar onOpenSettings={() => setOpenServerSettings(true)} />
              </div>

              {/* Chat */}
              <div className="flex-1 min-w-0 h-full rounded-xl border border-[#D5DAE0] overflow-hidden shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)]">
                <ChatPanel />
              </div>

              {/* Members */}
              <div className="h-full w-60 shrink-0 rounded-xl border border-[#D5DAE0] overflow-hidden shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)]">
                <MembersPanel onRefresh={refresh} />
              </div>
            </div>
          ) : (
            /* Mobile layout */
            <div className="h-full w-full relative pt-12">
              {mobileView === "sidebar" && (
                <div className="fixed inset-0 z-20 pt-12 bg-white overflow-hidden flex">
                  <div className="border-r border-[#D5DAE0]">
                    <ServersRail onRefresh={refresh} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ChannelsSidebar onOpenSettings={() => setOpenServerSettings(true)} />
                  </div>
                </div>
              )}

              {mobileView === "chat" && (
                <div className="h-full overflow-hidden">
                  <ChatPanel />
                </div>
              )}

              {mobileView === "members" && (
                <div className="fixed inset-0 z-20 pt-12 bg-white overflow-hidden">
                  <MembersPanel onRefresh={refresh} />
                </div>
              )}
            </div>
          )}

          <ServerSettingsModal
            open={openServerSettings}
            onOpenChange={setOpenServerSettings}
            onSuccess={refresh}
          />
        </div>
      )}
    </ServersLoader>
  );
}
