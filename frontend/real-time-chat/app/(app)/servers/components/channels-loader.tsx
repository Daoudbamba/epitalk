"use client";

import { useEffect } from "react";
import { useChannelStore } from "@/store/channel.store";

export function ChannelsLoader() {
  const setChannels = useChannelStore((s) => s.setChannels);

  useEffect(() => {
    fetch("/api/channels")
      .then((res) => {
        if (!res.ok) throw new Error("Erreur API channels");
        return res.json();
      })
      .then(setChannels)
      .catch((err) => {
        console.error("Erreur chargement channels", err);
      });
  }, [setChannels]);

  return null;
}
