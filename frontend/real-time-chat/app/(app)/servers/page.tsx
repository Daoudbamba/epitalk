import { ServersBar } from "./components/servers-bar";
import { ChannelsSidebar } from "./components/channels-sidebar";
import { ChatPanel } from "./components/chat-panel";
import { MembersPanel } from "./components/members-panel";

import { serversApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import type { Server } from "@/lib/api/schemas/servers.schema";

export default async function ServersPage() {
  let servers: Server[] = [];
  let errorMessage: string | null = null;

  // Test de l’API servers
  try {
    servers = await serversApi.list();
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  // En cas d’erreur API
  if (errorMessage) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-red-600">
          Erreur chargement serveurs : {errorMessage}
        </p>
      </div>
    );
  }

  console.log("SERVERS FROM API:", servers);

  // Layout normal (inchangé)
  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-2 text-sm text-green-600">
        ✅ Page servers chargée ({servers.length} serveurs reçus)
      </div>

      {/* Barre des serveurs (pas encore branchée aux données) */}
      <ServersBar servers={servers}/>

      <div className="flex flex-1 overflow-hidden">
        <ChannelsSidebar />
        <ChatPanel />
        <MembersPanel />
      </div>
    </div>
  );
}
