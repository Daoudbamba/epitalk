"use client";

import { useState } from "react";
import { ServersLoader } from "./components/servers-loader";
import { ServersRail } from "./components/servers-rail";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { Menu, Users, X } from "lucide-react";

export default function ServersPage() {
  const [showChannels, setShowChannels] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [openServerSettings, setOpenServerSettings] = useState(false);

  return (
    <ServersLoader>
      {({ refresh }) => (
        <div className="h-full w-full flex overflow-hidden relative">
          {/* Mobile top bar */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-[var(--card)] border-b flex items-center justify-between px-3">
            <button
              onClick={() => { setShowChannels(!showChannels); setShowMembers(false); }}
              className="p-2 rounded-lg hover:bg-[var(--surface)]"
            >
              {showChannels ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="text-sm font-semibold">EpiTalk</span>
            <button
              onClick={() => { setShowMembers(!showMembers); setShowChannels(false); }}
              className="p-2 rounded-lg hover:bg-[var(--surface)]"
            >
              {showMembers ? <X className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            </button>
          </div>

          {/* Left rail (servers) - hidden on mobile, shown on md+ */}
          <div className="hidden md:flex md:h-full">
            <ServersRail onRefresh={refresh} openSettings={openServerSettings} setOpenSettings={setOpenServerSettings} />
          </div>

          {/* Channels sidebar - responsive overlay on mobile */}
          <div className={`
            ${showChannels ? 'fixed inset-0 z-20 pt-12 bg-[var(--card)]' : 'hidden'}
            md:relative md:block md:pt-0 md:z-auto md:h-full
            md:w-60 lg:w-72 shrink-0 bg-[var(--card)] border-r border-[var(--border)]/20 overflow-hidden
          `}>
            {/* Mobile: show servers rail inline */}
            <div className="md:hidden border-b p-2">
              <ServersRail onRefresh={refresh} openSettings={openServerSettings} setOpenSettings={setOpenServerSettings} />
            </div>
            <ChannelsSidebar onOpenSettings={() => setOpenServerSettings(true)} />
          </div>

          {/* Chat - takes remaining space */}
          <div className={`flex-1 min-w-0 h-full bg-[var(--card)] overflow-hidden ${showChannels || showMembers ? 'hidden md:block' : ''} md:pt-0 pt-12`}>
            <ChatPanel />
          </div>

          {/* Members panel - responsive overlay on mobile */}
          <div className={`
            ${showMembers ? 'fixed inset-0 z-20 pt-12 bg-[var(--card)]' : 'hidden'}
            md:relative md:block md:pt-0 md:z-auto md:h-full
            md:w-60 lg:w-72 shrink-0 bg-[var(--card)] border-l border-[var(--border)]/20 overflow-hidden
          `}>
            <MembersPanel onRefresh={refresh} />
          </div>
        </div>
      )}
    </ServersLoader>
  );
}
