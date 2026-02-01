"use client";

import { useEffect, useState } from "react";
import type { Channel } from "@/lib/api/schemas/channels.schema";

export function ChannelsSidebar() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/channels")
      .then((res) => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((data: Channel[]) => {
        setChannels(data);
      })
      .catch((err) => {
        console.error("Erreur chargement channels", err);
      });
  }, []);

  return (
    <div className="w-64 border-r p-3">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
        Channels
      </h2>

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun channel
        </p>
      ) : (
        <ul className="space-y-1">
          {channels.map((channel) => {
            const isActive = channel.id === activeChannelId;

            return (
              <li
                key={channel.id}
                className={`cursor-pointer rounded px-2 py-1 text-sm ${
                  isActive
                    ? "bg-muted font-medium"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => setActiveChannelId(channel.id)}
              >
                {channel.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
