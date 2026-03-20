"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Smile, Gift, Sticker, Send, Loader2, Pin } from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useWebSocketStore } from "@/store/websocket.store";
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
  const isConnected = useWebSocketStore((s) => s.isConnected);
  const connect = useWebSocketStore((s) => s.connect);
  const sendMessage = useWebSocketStore((s) => s.sendMessage);
  const joinChannel = useWebSocketStore((s) => s.joinChannel);
  const wsMessages = useWebSocketStore((s) => s.messages);
  const startTyping = useWebSocketStore((s) => s.startTyping);
  const stopTyping = useWebSocketStore((s) => s.stopTyping);
  const typingUsers = useWebSocketStore((s) => s.typingUsers);

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
    return wsMessages[activeChannelId] || [];
  }, [activeChannelId, wsMessages]);

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

  // Get username from message, members or fallback to author_id
  const getUsernameById = useCallback((authorId: string, msgUsername?: string): string => {
    // Check if username is provided in the message itself
    if (msgUsername) return msgUsername;
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
  }, [members, user]);

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
      // Stop typing when message sent
      if (activeChannelId) stopTyping(activeChannelId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur envoi message");
    } finally {
      setSending(false);
    }
  };

  // Typing indicator: track when user is typing
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      if (!activeChannelId || !isConnected) return;

      if (newValue.trim()) {
        startTyping(activeChannelId);
        // Clear previous timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        // Stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          if (activeChannelId) stopTyping(activeChannelId);
        }, 2000);
      } else {
        stopTyping(activeChannelId);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    },
    [activeChannelId, isConnected, startTyping, stopTyping],
  );

  // Get typing users for current channel (exclude self)
  const currentTypingUsers = useMemo(() => {
    if (!activeChannelId) return [];
    const users = typingUsers[activeChannelId] || [];
    return users.filter((uid) => uid !== user?.id);
  }, [activeChannelId, typingUsers, user?.id]);

  const typingDisplay = useMemo(() => {
    if (currentTypingUsers.length === 0) return null;
    const names = currentTypingUsers.map((uid) => getUsernameById(uid));
    if (names.length === 1) return `${names[0]} est en train d'écrire...`;
    if (names.length === 2) return `${names[0]} et ${names[1]} écrivent...`;
    return `${names.length} personnes écrivent...`;
  }, [currentTypingUsers, getUsernameById]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="h-[95%] rounded-2xl my-4 mx-2 border border-[#E5E7EB] min-w-0 flex flex-col bg-white shadow-lg overflow-hidden">
      
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
        ) : !isConnected ? (
          <div className="px-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connexion au serveur...
          </div>
        ) : messages.length === 0 ? (
          <div className="px-4 text-sm text-muted-foreground">
            Aucun message dans ce channel. Soyez le premier à écrire !
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
                    {getUsernameById(msg.author_id, msg.username).slice(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="flex flex-col w-full">
                  <div className="flex items-center gap-x-2">
                    <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">
                      {getUsernameById(msg.author_id, msg.username)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                    {msg.edited_at && (
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        modifie
                      </span>
                    )}
                    {msg.pinned_at && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                        title={`Epingle le ${new Date(msg.pinned_at).toLocaleString()}`}
                      >
                        <Pin className="h-3 w-3" />
                        epingle
                      </span>
                    )}
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
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 transition rounded-full p-1 flex items-center justify-center text-white"
              disabled
              title="Fonction à venir"
            >
              <Plus className="text-white dark:text-[#313338]" />
            </button>

            <Input
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!canLoad || sending || !isConnected}
              className="px-14 pr-32 py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200 placeholder:text-zinc-500"
              placeholder={
                !canLoad
                  ? "Sélectionne un channel..."
                  : !isConnected
                  ? "Connexion en cours..."
                  : `Envoyer un message dans #${activeChannelName ?? ""}`
              }
            />

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-x-3">
              <span title="Fonction à venir">
                <Gift className="h-5 w-5 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-not-allowed" />
              </span>

              <span title="Fonction à venir">
                <Sticker className="h-5 w-5 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-not-allowed" />
              </span>

              <span title="Fonction à venir">
                <Smile className="h-5 w-5 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-not-allowed" />
              </span>
            </div>
          </div>

          {/* Bouton Envoyer */}
          <Button
            onClick={onSend}
            disabled={!canLoad || sending || !isConnected || !value.trim()}
            className="h-12 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Envoyer le message"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {/* Typing indicator */}
        {typingDisplay && (
          <div className="mt-1 px-1 text-xs text-indigo-500 flex items-center gap-1 animate-pulse">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {typingDisplay}
          </div>
        )}
        
        {/* Connection status */}
        {!isConnected && canLoad && (
          <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reconnexion en cours...
          </div>
        )}
      </div>
    </div>
  );
}
