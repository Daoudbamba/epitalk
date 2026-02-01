"use client";

import { ServersLoader } from "./components/servers-loader";
import { ServersBar } from "./components/servers-bar";
import { MembersPanel } from "./components/members-panel";
import { useServerStore } from "@/store/server.store";

export default function ServersPage() {
  const activeServerId = useServerStore((s) => s.activeServerId);
  const servers = useServerStore((s) => s.servers);

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;

  return (
    <ServersLoader>
      {({ refresh, loading }) => (
        <div className="flex h-full flex-col">
          <ServersBar onRefresh={refresh} />

          <div className="flex flex-1">
            <div className="flex-1 p-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : activeServer ? (
                <div className="space-y-1">
                  <div className="text-base font-semibold">{activeServer.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Server ID: <span className="font-mono">{activeServer.id}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun serveur</p>
              )}
            </div>

            <MembersPanel server={activeServer} />
          </div>
        </div>
      )}
    </ServersLoader>
  );
}
