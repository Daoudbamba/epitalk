"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Server } from "@/lib/api/schemas/servers.schema";

type ServersBarProps = {
  servers: Server[];
};

export function ServersBar({ servers }: ServersBarProps) {
  const [activeServerId, setActiveServerId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      {servers.map((server) => {
        const isActive = server.id === activeServerId;

        return (
          <Button
          className="hover:cursor-pointer"
            key={server.id}
            variant={isActive ? "default" : "outline"}
            onClick={() => setActiveServerId(server.id)}
          >
            {server.name}
          </Button>
        );
      })}

      <div className="ml-auto">
        <Button> Nouveau serveur</Button>
      </div>
    </div>
  );
}
