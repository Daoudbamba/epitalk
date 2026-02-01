"use client";

import { ServersLoader } from "./components/servers-loader";
import { ServersBar } from "./components/servers-bar";
import { MembersPanel } from "./components/members-panel";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { ChatPanel } from "./components/chat-panel";

export default function ServersPage() {
  return (
    <ServersLoader>
      {({ refresh }) => (
        <div className="flex h-full flex-col">
          <ServersBar onRefresh={refresh} />

          <div className="flex flex-1 overflow-hidden">
            <div className="w-72 border-r overflow-hidden">
              <ChannelsSidebar />
            </div>

            <div className="flex-1 overflow-hidden">
              <ChatPanel />
            </div>

            <MembersPanel />
          </div>
        </div>
      )}
    </ServersLoader>
  );
}
