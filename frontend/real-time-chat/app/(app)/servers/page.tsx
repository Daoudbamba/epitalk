import { ServersBar } from "./components/servers-bar";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";
import { ServersLoader } from "./components/servers-loader";
import { ChannelsLoader } from "./components/channels-loader";

export default function ServersPage() {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Loaders client */}
      <ServersLoader />
      <ChannelsLoader />

      <ServersBar />

      <div className="flex flex-1 overflow-hidden">
        <ChannelsSidebar />
        <ChatPanel />
        <MembersPanel />
      </div>
    </div>
  );
}
