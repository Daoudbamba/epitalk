"use client";

import { useEffect, useState } from "react";
import type { Channel } from "@/lib/api/schemas/channels.schema";
import { channelsApi } from "@/lib/api";

export function ChannelsSidebar() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  useEffect(() => {
    channelsApi
      .list()
      .then(setChannels)
      .catch(() => {
        // pour l’instant on ignore les erreurs
      });
  }, []);

  useEffect(() => {
    console.log("➡️ ChannelsSidebar mounted");

    channelsApi
      .list()
      .then((data) => {
        console.log("✅ Channels reçus depuis API :", data);
        setChannels(data);
      })
      .catch((err) => {
        console.error("❌ Erreur chargement channels :", err);
      });
  }, []);

  return (
    <div className="w-64 border-r p-3">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
        Channels
      </h2>

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun channel</p>
      ) : (
        <ul className="space-y-1">
          {channels.map((channel) => {
            const isActive = channel.id === activeChannelId;

            return (
              <li
                key={channel.id}
                className={`cursor-pointer rounded px-2 py-1 text-sm ${
                  isActive ? "bg-muted font-medium" : "hover:bg-muted/50"
                }`}
                onClick={() => setActiveChannelId(channel.id)}
              >
                #{channel.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
