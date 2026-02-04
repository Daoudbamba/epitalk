"use client";

import { ServersLoader } from "./components/servers-loader";
import { ServersRail } from "./components/servers-rail";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";
import { ChannelsSidebar } from "./components/channels-sidebar";

export default function ServersPage() {
  return (
    <ServersLoader>
      {({ refresh }) => (
        <div className="h-full w-full flex overflow-hidden">
          {/* Left rail (servers) */}
          <ServersRail onRefresh={refresh} />

          {/* Channels */}
          <div className="w-80 shrink-0 bg-white/90 dark:bg-[#2b2d31] border-r border-white/20 overflow-hidden">
            <ChannelsSidebar />
          </div>

          {/* Chat */}
          <div className="flex-1 min-w-0 bg-white dark:bg-[#313338] overflow-hidden">
            <ChatPanel />
          </div>

          {/* Members */}
          <div className="w-72 shrink-0 bg-white/90 dark:bg-[#2b2d31] border-l border-white/20 overflow-hidden">
            <MembersPanel onRefresh={refresh} />
          </div>
        </div>
      )}
    </ServersLoader>
  );
}
