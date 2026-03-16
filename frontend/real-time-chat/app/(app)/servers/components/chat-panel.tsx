"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Smile, Gift, Sticker, Send, Loader2, CornerUpLeft, Edit3, Trash2, X } from "lucide-react";
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
  const editMessage = useWebSocketStore((s) => s.editMessage);
  const deleteMessage = useWebSocketStore((s) => s.deleteMessage);
  const joinChannel = useWebSocketStore((s) => s.joinChannel);
  const wsMessages = useWebSocketStore((s) => s.messages);
  const socket = useWebSocketStore((s) => s.socket);
  const startTyping = useWebSocketStore((s) => s.startTyping);
  const stopTyping = useWebSocketStore((s) => s.stopTyping);
  const typingUsers = useWebSocketStore((s) => s.typingUsers);

  const activeChannelName = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId)?.name ?? null;
  }, [channels, activeChannelId]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyToUsername, setReplyToUsername] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

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
    const el = bottomRef.current as HTMLElement | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (el && typeof (el as any).scrollIntoView === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Get username from message, members or fallback to author_id
  const getUsernameById = useCallback(
    (authorId: string, msgUsername?: string): string => {
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
    },
    [user, members],
  );

  const currentMemberRole = members.find((m) => m.user_id === user?.id)?.role;
  const canModerate = currentMemberRole === "Owner" || currentMemberRole === "Admin" || currentMemberRole === "Moderator";

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
      if (isEditing && editingMessageId) {
        editMessage(activeChannelId, editingMessageId, content);
        setEditingMessageId(null);
        setIsEditing(false);
      } else {
        sendMessage(activeChannelId, content, replyTo || undefined);
        setReplyTo(null);
        setReplyToUsername(null);
      }
      setValue("");
      if (activeChannelId) stopTyping(activeChannelId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur envoi message");
    } finally {
      setSending(false);
    }
  };

  const cancelPendingAction = () => {
    setIsEditing(false);
    setEditingMessageId(null);
    setReplyTo(null);
    setValue("");
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

  // Autocomplete/debounced GIF search when picker is open
  useEffect(() => {
    if (openGifPicker !== "input") return;

    const query =
      gifQuery && gifQuery.trim() !== "" ? gifQuery.trim() : "trending";
    const controller = new AbortController();
    setGifLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/gifs/search?q=${encodeURIComponent(query)}&limit=24`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setGifResults([]);
          setGifLoading(false);
          return;
        }
        const json = await res.json();
        const results: {
          id: string;
          url: string;
          preview?: string;
          provider?: string;
        }[] = [];
        if (json.results) {
          for (const it of json.results) {
            const id = it.id || "";
            const url = it.url || "";
            const preview = it.preview || undefined;
            const provider = it.provider || undefined;
            if (url)
              results.push({ id: id.toString(), url, preview, provider });
          }
        } else if (json.data) {
          for (const it of json.data) {
            const id = it.id || "";
            const url =
              it.images?.original?.url || it.images?.fixed_width?.url || "";
            const preview =
              it.images?.preview_gif?.url ||
              it.images?.fixed_width_small_still?.url;
            if (url)
              results.push({
                id: id.toString(),
                url,
                preview,
                provider: "giphy",
              });
          }
        }
        setGifResults(results);
      } catch (err: unknown) {
        // Ignore AbortError (fetch aborted on quick typing / picker close)
        if (!(err instanceof DOMException) || err.name !== "AbortError") {
          console.error("GIF search failed", err);
        }
        setGifResults([]);
      } finally {
        setGifLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [gifQuery, openGifPicker]);

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
            {messages.map((msg) => {
              const isAuthor = user?.id === msg.author_id;
              const canDelete = isAuthor || canModerate;
              const messageUsername = getUsernameById(msg.author_id, msg.username);
              return (
                <div
                  key={msg.id}
                  className="group flex items-start p-4 hover:bg-black/5 dark:hover:bg-white/5 transition w-full"
                >
                  <div className="mr-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-100">
                      {messageUsername.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="flex flex-col w-full">
                    <div className="flex items-center gap-x-2">
                      <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">
                        {messageUsername}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                      {msg.edited_at && (
                        <span className="text-xs text-indigo-500">(édité)</span>
                      )}
                    </div>

                    {msg.reply_to && (() => {
                      const original = messages.find((m) => m.id === msg.reply_to);
                      return (
                        <div className="text-xs text-zinc-500 italic mb-1 bg-zinc-100 dark:bg-zinc-800 p-2 rounded-md">
                          Réponse à {original ? getUsernameById(original.author_id, original.username) : msg.reply_to.slice(0, 8)}:
                          <div className="truncate max-w-full">
                            {original ? original.content : "message introuvable"}
                          </div>
                        </div>
                      );
                    })()}

                    <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                      {msg.content}
                    </p>

                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        className="text-indigo-500 hover:text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-800/40 dark:hover:bg-indigo-700 p-1.5 rounded-full transition"
                        onClick={() => {
                          setReplyTo(msg.id);
                          setReplyToUsername(messageUsername);
                          setValue("");
                        }}
                        title="Répondre"
                      >
                        <CornerUpLeft className="h-4 w-4" />
                      </button>
                      {isAuthor && (
                        <button
                          className="text-emerald-600 hover:text-emerald-800 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-800/40 dark:hover:bg-emerald-700 p-1.5 rounded-full transition"
                          onClick={() => {
                            setIsEditing(true);
                            setEditingMessageId(msg.id);
                            setValue(msg.content);
                          }}
                          title="Modifier"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200 dark:bg-red-800/40 dark:hover:bg-red-700 p-1.5 rounded-full transition"
                          onClick={() => deleteMessage(activeChannelId || "", msg.id)}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>
        )}

        {error && <div className="px-4 mt-2 text-xs text-red-500">{error}</div>}
      </div>

      {/* --- INPUT --- */}
      <div className="p-4 mb-2 shrink-0">
        {((replyTo && !isEditing) || isEditing) && (
          <div className="mb-2 rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200 flex items-center justify-between">
            <div>
              {isEditing ? "Modification du message en cours" : "Réponse en cours"}
              {replyTo && !isEditing && replyToUsername ? `: ${replyToUsername}` : ""}
            </div>
            <button
              className="text-indigo-700 underline text-xs flex items-center gap-1"
              onClick={cancelPendingAction}
            >
              <X className="h-3 w-3" /> Annuler
            </button>
          </div>
        )}
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

              <button
                type="button"
                onClick={() =>
                  setOpenGifPicker(openGifPicker === "input" ? null : "input")
                }
                title="GIF"
                className="h-6 w-6 flex items-center justify-center"
              >
                <Sticker className="h-5 w-5 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer" />
              </button>

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

        {/* GIF picker anchored to input bar */}
        {openGifPicker === "input" && (
          <div className="absolute left-4 right-4 bottom-20 z-50 bg-white dark:bg-zinc-900 border rounded-lg shadow-md p-3 w-[min(90vw,40rem)]">
            <div className="flex gap-2 mb-2">
              <input
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                placeholder="Recherche de GIFs"
                className="flex-1 px-2 py-1 border rounded bg-zinc-50 dark:bg-zinc-800"
              />
              <button
                onClick={async () => {
                  setGifLoading(true);
                  try {
                    const res = await fetch(
                      `/api/gifs/search?q=${encodeURIComponent(
                        gifQuery || "trending",
                      )}&limit=24`,
                    );
                    if (!res.ok) {
                      setGifResults([]);
                      setGifLoading(false);
                      return;
                    }
                    const json = await res.json();
                    const results: {
                      id: string;
                      url: string;
                      preview?: string;
                      provider?: string;
                    }[] = [];
                    if (json.results) {
                      for (const it of json.results) {
                        const id = it.id || "";
                        const url = it.url || "";
                        const preview = it.preview || undefined;
                        const provider = it.provider || undefined;
                        if (url)
                          results.push({
                            id: id.toString(),
                            url,
                            preview,
                            provider,
                          });
                      }
                    } else if (json.data) {
                      for (const it of json.data) {
                        const id = it.id || "";
                        const url =
                          it.images?.original?.url ||
                          it.images?.fixed_width?.url ||
                          "";
                        const preview =
                          it.images?.preview_gif?.url ||
                          it.images?.fixed_width_small_still?.url;
                        if (url)
                          results.push({
                            id: id.toString(),
                            url,
                            preview,
                            provider: "giphy",
                          });
                      }
                    }
                    setGifResults(results);
                  } catch (err) {
                    console.error("GIF search failed", err);
                    setGifResults([]);
                  } finally {
                    setGifLoading(false);
                  }
                }}
                className="px-2 py-1 bg-indigo-600 text-white rounded"
                disabled={gifLoading}
              >
                {gifLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Rechercher"
                )}
              </button>
              <button
                onClick={() => {
                  setOpenGifPicker(null);
                  setGifResults([]);
                  setGifQuery("");
                }}
                className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded"
              >
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-64 overflow-auto">
              {gifResults.map((g) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={g.id}
                  src={g.preview || g.url}
                  alt="gif"
                  className="h-20 w-full object-cover rounded cursor-pointer"
                  onClick={() => {
                    try {
                      if (
                        socket &&
                        socket.readyState === WebSocket.OPEN &&
                        activeChannelId
                      ) {
                        const ev = {
                          type: "MessageSendGif",
                          payload: {
                            channel_id: activeChannelId,
                            gif: {
                              id: g.id,
                              url: g.url,
                              preview: g.preview,
                              provider: g.provider,
                            },
                            caption: null,
                          },
                        };
                        socket.send(JSON.stringify(ev));
                      }
                    } catch (e) {
                      console.error("Failed to send gif", e);
                      setError("Erreur lors de l'envoi du GIF");
                    } finally {
                      setOpenGifPicker(null);
                      setGifResults([]);
                      setGifQuery("");
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {typingDisplay && (
          <div className="mt-1 px-1 text-xs text-indigo-500 flex items-center gap-1 animate-pulse">
            <span className="flex gap-0.5">
              <span
                className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
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
