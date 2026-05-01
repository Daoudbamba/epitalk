"use client";

import { useState, useEffect } from "react";
import { ServersRail } from "../servers/components/servers-rail";
import { DmSidebar } from "./components/dm-sidebar";
import { DmChatPanel } from "./components/dm-chat-panel";
import { useDmStore } from "@/store/dm.store";

type MobileView = "sidebar" | "chat";

export default function DmPage() {
  const activePeerId = useDmStore((s) => s.activePeerId);
  const [mobileView, setMobileView] = useState<MobileView>("sidebar");
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setMobileView(activePeerId ? "chat" : "sidebar");
    }
  }, [activePeerId, isDesktop]);

  const noop = async () => {};

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#FAFBFC] p-5">
      {isDesktop ? (
        <div className="flex h-full gap-5">
          {/* Rail */}
          <div className="h-full w-22 shrink-0 rounded-xl border border-[#D5DAE0] overflow-hidden shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)]">
            <ServersRail onRefresh={noop} />
          </div>

          {/* DM Sidebar */}
          <div className="h-full w-70 shrink-0 rounded-xl border border-[#D5DAE0] overflow-hidden shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)]">
            <DmSidebar />
          </div>

          {/* Chat */}
          <div className="flex-1 min-w-0 h-full rounded-xl border border-[#D5DAE0] overflow-hidden shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)]">
            <DmChatPanel />
          </div>
        </div>
      ) : (
        <div className="h-full w-full flex overflow-hidden relative">
          {mobileView === "sidebar" && <DmSidebar />}
          {mobileView === "chat" && <DmChatPanel />}
        </div>
      )}
    </div>
  );
}
