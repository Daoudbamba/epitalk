"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus, Smile, Gift, Sticker } from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { messagesApi } from "@/lib/api";
import type { Message } from "@/lib/api/schemas/messages.schema";

export function ChatPanel() {
  const activeServerId = useServerStore((s) => s.activeServerId);

  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);

  const activeChannelName = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId)?.name ?? null;
  }, [channels, activeChannelId]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [value, setValue] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canLoad = !!activeServerId && !!activeChannelId;

  const loadMessages = async () => {
    if (!activeServerId || !activeChannelId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await messagesApi.list(activeServerId, activeChannelId);
      setMessages(data);
      // scroll bottom after load
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "auto" }),
        0,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // recharge quand on change de serveur ou de channel
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeServerId, activeChannelId]);

  const onSend = async () => {
    if (!activeServerId || !activeChannelId) return;

    const content = value.trim();
    if (!content) return;

    setSending(true);
    setError(null);

    try {
      // Envoi
      await messagesApi.send(activeServerId, activeChannelId, content);

      // clear input puis refresh liste (pas realtime)
      setValue("");
      await loadMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur envoi message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-[#313338]">
      {/* --- HEADER --- */}
      <div className="h-12 px-4 flex items-center border-b shadow-sm dark:border-zinc-800 shrink-0">
        <span className="text-zinc-500 mr-2 text-2xl">#</span>
        <h2 className="font-bold text-md text-zinc-800 dark:text-zinc-100">
          {activeChannelName ?? "aucun-channel"}
        </h2>
      </div>

      {/* --- MESSAGES --- */}
      <div className="flex-1 overflow-y-auto flex flex-col py-4">
        {!canLoad ? (
          <div className="px-4 text-sm text-muted-foreground">
            Sélectionne un serveur et un channel.
          </div>
        ) : loading ? (
          <div className="px-4 text-sm text-muted-foreground">
            Chargement...
          </div>
        ) : messages.length === 0 ? (
          <div className="px-4 text-sm text-muted-foreground">
            Aucun message dans ce channel.
          </div>
        ) : (
          <div className="flex flex-col mt-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="group flex items-start p-4 hover:bg-black/5 dark:hover:bg-white/5 transition w-full"
              >
                <div className="mr-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-100">
                    {msg.username.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="flex flex-col w-full">
                  <div className="flex items-center gap-x-2">
                    <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">
                      {msg.username}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        )}

        {error && <div className="px-4 mt-2 text-xs text-red-500">{error}</div>}
      </div>

      {/* --- INPUT --- */}
      <div className="p-4 mb-2 shrink-0">
        <div className="relative">
          <button
            type="button"
            className="absolute left-4 top-3 h-6 w-6 bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 transition rounded-full p-1 flex items-center justify-center text-white"
            disabled
            title="Fonction à venir"
          >
            <Plus className="text-white dark:text-[#313338]" />
          </button>

          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend();
            }}
            disabled={!canLoad || sending}
            className="px-14 py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200 placeholder:text-zinc-500"
            placeholder={
              !canLoad
                ? "Sélectionne un channel..."
                : `Envoyer un message dans #${activeChannelName ?? ""}`
            }
          />

          <div className="absolute right-4 top-3 flex items-center gap-x-4">
            <span title="Fonction à venir">
              <Gift className="text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-not-allowed" />
            </span>

            <span title="Fonction à venir">
              <Sticker className="text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-not-allowed" />
            </span>

            <span title="Fonction à venir">
              <Smile className="text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-not-allowed" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
