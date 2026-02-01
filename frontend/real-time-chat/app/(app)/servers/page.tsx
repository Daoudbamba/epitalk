import { ServersBar } from "./components/servers-bar";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";
import { ServersLoader } from "./components/servers-loader";

export default function ServersPage() {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Charge les serveurs dans le store */}
      <ServersLoader />

      <ServersBar />

      <div className="flex flex-1 overflow-hidden">
        <ChannelsSidebar />
        <ChatPanel />
        <MembersPanel />
      </div>
    </div>
  );
}
