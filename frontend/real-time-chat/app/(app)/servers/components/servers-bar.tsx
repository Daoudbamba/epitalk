import { Button } from "@/components/ui/button";
import type { Server } from "@/lib/api/schemas/servers.schema";

type ServersBarProps = {
  servers: Server[];
};

export function ServersBar({ servers }: ServersBarProps) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      {servers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun serveur
        </p>
      ) : (
        servers.map((server) => (
          <Button key={server.id} variant="outline">
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
