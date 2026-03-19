"use client";

import { DmRail } from "./components/dm-rail";
import { DmSidebar } from "./components/dm-sidebar";
import { DmChatPanel } from "./components/dm-chat-panel";

export default function DmPage() {
  return (
    <div className="h-full w-full flex overflow-hidden relative">
      {/* Left rail */}
      <div className="hidden md:flex md:h-full">
        <DmRail />
      </div>

      {/* Conversations sidebar */}
      <div className="hidden md:block md:w-60 lg:w-72 shrink-0 h-full overflow-hidden">
        <DmSidebar />
      </div>

      {/* Chat panel */}
      <div className="flex-1 min-w-0 h-full bg-white overflow-hidden">
        <DmChatPanel />
      </div>
    </div>
  );
}
