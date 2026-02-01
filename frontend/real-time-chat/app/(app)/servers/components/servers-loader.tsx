"use client";

import { useEffect } from "react";
import { serversApi } from "@/lib/api";
import { useServerStore } from "@/store/server.store";

export function ServersLoader() {
  const setServers = useServerStore((s) => s.setServers);

  useEffect(() => {
    serversApi
      .list()
      .then(setServers)
      .catch((err) => {
        console.error("Erreur chargement serveurs", err);
      });
  }, [setServers]);

  return null;
}
