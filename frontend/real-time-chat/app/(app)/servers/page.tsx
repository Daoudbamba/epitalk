"use client";

import { useState } from "react";
import { ServersLoader } from "./components/servers-loader";
import { ServersRail } from "./components/servers-rail";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { BackendHealthIndicator } from "./components/backend-health-indicator";
import { Menu, Users, X } from "lucide-react";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { useWebSocketStore } from "@/store/websocket.store";

export default function ServersPage() {
  const [showChannels, setShowChannels] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const wsError = useWebSocketStore((s) => s.error);
  const wsConnectionState = useWebSocketStore((s) => s.connectionState);
  const clearWsError = useWebSocketStore((s) => s.clearError);
  const blockingWsError = wsConnectionState === "auth_invalid" ? wsError : null;

  return (
    <ServersLoader>
      {({ refresh }) => (
        <div className="h-full w-full flex overflow-hidden relative">
          {/* Mobile top bar */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-white dark:bg-[#313338] border-b flex items-center justify-between px-3">
            <button
              onClick={() => { setShowChannels(!showChannels); setShowMembers(false); }}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {showChannels ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">EpiTalk</span>
              <BackendHealthIndicator />
            </div>
            <button
              onClick={() => { setShowMembers(!showMembers); setShowChannels(false); }}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {showMembers ? <X className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            </button>
          </div>

          <div className="hidden md:block absolute right-3 top-3 z-20">
            <BackendHealthIndicator />
          </div>

          {/* Left rail (servers) - hidden on mobile, shown on md+ */}
          <div className="hidden md:flex md:h-full">
            <ServersRail onRefresh={refresh} />
          </div>

          {/* Channels sidebar - responsive overlay on mobile */}
          <div className={`
            ${showChannels ? 'fixed inset-0 z-20 pt-12 bg-white dark:bg-[#2b2d31]' : 'hidden'}
            md:relative md:block md:pt-0 md:z-auto md:h-full
            md:w-60 lg:w-72 shrink-0 bg-white/90 dark:bg-[#2b2d31] border-r border-white/20 overflow-hidden
          `}>
            {/* Mobile: show servers rail inline */}
            <div className="md:hidden border-b p-2">
              <ServersRail onRefresh={refresh} />
            </div>
            <ChannelsSidebar />
          </div>

          {/* Chat - takes remaining space */}
          <div className={`flex-1 min-w-0 h-full bg-white dark:bg-[#313338] overflow-hidden ${showChannels || showMembers ? 'hidden md:block' : ''} md:pt-0 pt-12`}>
            <ChatPanel />
          </div>

          {/* Members panel - responsive overlay on mobile */}
          <div className={`
            ${showMembers ? 'fixed inset-0 z-20 pt-12 bg-white dark:bg-[#2b2d31]' : 'hidden'}
            md:relative md:block md:pt-0 md:z-auto md:h-full
            md:w-60 lg:w-72 shrink-0 bg-white/90 dark:bg-[#2b2d31] border-l border-white/20 overflow-hidden
          `}>
            <MembersPanel onRefresh={refresh} />
          </div>

            <ConfirmActionDialog
              open={!!blockingWsError}
              onOpenChange={(open) => {
                if (!open) clearWsError();
              }}
              title="Information"
              description={blockingWsError ?? ""}
              confirmLabel="Compris"
              onConfirm={() => {
                clearWsError();
                if (blockingWsError?.toLowerCase().includes("banni")) {
                  window.location.reload();
                }
              }}
            />
        </div>
      )}
    </ServersLoader>
  );
}
