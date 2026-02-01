"use client";

import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";

export function ServersBar() {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      {servers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun serveur
        </p>
      ) : (
        servers.map((server) => (
          <Button
            key={server.id}
            variant={
              server.id === activeServerId ? "default" : "outline"
            }
            onClick={() => setActiveServer(server.id)}
          >
            {server.name}
          </Button>
        ))
      )}

      <div className="ml-auto">
        <Button>+ Nouveau serveur</Button>
      </div>
    </div>
  );
}
