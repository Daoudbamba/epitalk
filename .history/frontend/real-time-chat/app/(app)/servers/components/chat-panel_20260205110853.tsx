"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Smile, Gift, Sticker, Send, Loader2 } from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useWebSocketStore, type WsMessage } from "@/store/websocket.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";

export function ChatPanel() {
  const activeServerId = useServerStore((s) => s.activeServerId);

  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);

  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const members = useMemberStore((s) => s.members);

  // WebSocket store
  const {
    isConnected,
    connect,
    sendMessage,
    joinChannel,
    getMessages,
  } = useWebSocketStore();

  const activeChannelName = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId)?.name ?? null;
  }, [channels, activeChannelId]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canLoad = !!activeServerId && !!activeChannelId;

  // Get messages for current channel
  const messages = useMemo(() => {
    if (!activeChannelId) return [];
    return getMessages(activeChannelId);
  }, [activeChannelId, getMessages, useWebSocketStore((s) => s.messages)]);

  // Connect WebSocket on mount
  useEffect(() => {
    if (token && !isConnected) {
      connect(token);
    }
  }, [token, isConnected, connect]);

  // Join channel when it changes
  useEffect(() => {
    if (activeChannelId && isConnected) {
      joinChannel(activeChannelId);
    }
  }, [activeChannelId, isConnected, joinChannel]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Get username from members or fallback to author_id
  const getUsernameById = (authorId: string): string => {
    // Check if it's the current user
    if (user && user.id === authorId) {
      return user.username;
    }
    // Check members
    const member = members.find((m) => m.user_id === authorId);
    if (member) {
      return member.username;
    }
    // Fallback: use first part of UUID
    return authorId.slice(0, 8);
  };

  const onSend = async () => {
    if (!activeChannelId || !canLoad) return;

    const content = value.trim();
    if (!content) return;

    if (!isConnected) {
      setError("Non connecté au serveur");
      return;
    }

    setSending(true);
    setError(null);

    try {
      sendMessage(activeChannelId, content);
      setValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur envoi message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="h-[95%] rounded-md my-5 mx-2 mb-30 border-2 border-gray-200 flex-1 min-w-0 flex flex-col bg-white">
      
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
                      {new Date(msg.created_at).toLocaleString()}
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
