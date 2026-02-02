"use client";

import { useChannelStore } from "@/store/channel.store";

export function ChannelsSidebar() {
  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);

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
                onClick={() => setActiveChannel(channel.id)}
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
