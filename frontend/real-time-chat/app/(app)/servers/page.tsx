"use client";

import { ServersLoader } from "./components/servers-loader";
import { ServersBar } from "./components/servers-bar";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";
import { ChannelsSidebar } from "./components/channels-sidebar";


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
            {/* Centre : vide pour l’instant (pas de messagerie) */}
            <div className="flex-1 p-6">
              <p className="text-sm text-muted-foreground">
                <ChatPanel />
              </p>
            </div>

            <MembersPanel />
          </div>
        </div>
      )}
    </ServersLoader>
  );
}
