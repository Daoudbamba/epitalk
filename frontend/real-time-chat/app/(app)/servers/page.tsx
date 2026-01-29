import { ServersBar } from "./components/servers-bar";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel"; 

export default function ServersPage() {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Barre des serveurs */}
      <ServersBar />

      {/* Contenu principal */}
      <div className="flex flex-1 overflow-hidden">
        <ChannelsSidebar />
        <ChatPanel />
        <MembersPanel />
      </div>
    </div>
  );
}
