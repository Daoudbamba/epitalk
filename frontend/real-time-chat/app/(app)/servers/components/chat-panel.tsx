"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Smile, Gift, Sticker, Send, Loader2, Pin, Search, ChevronDown, ChevronUp, X } from "lucide-react";
import { messagesApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import type { Message } from "@/lib/api/schemas/messages.schema";
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
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const members = useMemberStore((s) => s.members);

  // WebSocket store
  const isConnected = useWebSocketStore((s) => s.isConnected);
  const connectionState = useWebSocketStore((s) => s.connectionState);
  const reconnectAttempt = useWebSocketStore((s) => s.reconnectAttempt);
  const nextRetryDelayMs = useWebSocketStore((s) => s.nextRetryDelayMs);
  const connect = useWebSocketStore((s) => s.connect);
  const disconnect = useWebSocketStore((s) => s.disconnect);
  const sendMessage = useWebSocketStore((s) => s.sendMessage);
  const editMessage = useWebSocketStore((s) => s.editMessage);
  const deleteMessage = useWebSocketStore((s) => s.deleteMessage);
  const joinChannel = useWebSocketStore((s) => s.joinChannel);
  const wsMessages = useWebSocketStore((s) => s.messages);
  const socket = useWebSocketStore((s) => s.socket);
  const startTyping = useWebSocketStore((s) => s.startTyping);
  const stopTyping = useWebSocketStore((s) => s.stopTyping);
  const typingUsers = useWebSocketStore((s) => s.typingUsers);
  const setMessages = useWebSocketStore((s) => s.setMessages);

  const activeChannelName = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId)?.name ?? null;
  }, [channels, activeChannelId]);

  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [pinLoadingByMessageId, setPinLoadingByMessageId] = useState<Record<string, boolean>>({});
  const [showPinnedPanel, setShowPinnedPanel] = useState(true);
  const [loadingPinnedMessages, setLoadingPinnedMessages] = useState(false);
  const [pinnedMessagesError, setPinnedMessagesError] = useState<string | null>(null);
  const [pinnedMessagesFromApi, setPinnedMessagesFromApi] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; author_id: string; username?: string; content: string; created_at: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyToUsername, setReplyToUsername] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // GIF picker state
  const [openGifPicker, setOpenGifPicker] = useState<"input" | null>(null);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview?: string; provider?: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);

  // Emoji reaction picker state
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmojis, setShowInputEmojis] = useState(false);
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canLoad = !!activeServerId && !!activeChannelId;

  const connectionStatusLabel = useMemo(() => {
    if (isConnected) return null;

    const retryInSeconds = nextRetryDelayMs ? Math.max(1, Math.ceil(nextRetryDelayMs / 1000)) : null;

    if (connectionState === "degraded") {
      return `Serveur indisponible. Nouvelle tentative automatique dans ${retryInSeconds ?? 30}s.`;
    }

    if (connectionState === "auth_invalid") {
      return "Session expirée. Reconnecte-toi pour rétablir le temps réel.";
    }

    if (connectionState === "backoff") {
      return `Reconnexion en cours (tentative ${Math.max(1, reconnectAttempt)}${retryInSeconds ? `, prochaine dans ${retryInSeconds}s` : ""})...`;
    }

    if (connectionState === "connecting") {
      return "Connexion au serveur en cours...";
    }

    return "Connexion au serveur...";
  }, [connectionState, isConnected, nextRetryDelayMs, reconnectAttempt]);

  // Get messages for current channel
  const messages = useMemo(() => {
    if (!activeChannelId) return [];
    return wsMessages[activeChannelId] || [];
  }, [activeChannelId, wsMessages]);

  const pinnedMessagesInMemory = useMemo(() => {
    return messages
      .filter((message) => !!message.pinned_at)
      .sort((a, b) => {
        const aTs = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
        const bTs = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
        return bTs - aTs;
      });
  }, [messages]);

  const pinnedMessages = useMemo(() => {
    if (pinnedMessagesFromApi.length === 0) {
      return pinnedMessagesInMemory;
    }

    const byId = new Map<string, Message>();
    for (const msg of pinnedMessagesFromApi) {
      byId.set(msg.id, msg);
    }
    for (const msg of pinnedMessagesInMemory) {
      if (!byId.has(msg.id)) {
        byId.set(msg.id, msg);
      }
    }

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [pinnedMessagesFromApi, pinnedMessagesInMemory]);

  // Connect WebSocket on mount
  useEffect(() => {
    if (!hasHydrated) return;

    let latestToken = token;
    if (typeof window !== "undefined") {
      const persistedToken = localStorage.getItem("token");
      if (persistedToken !== token) {
        latestToken = persistedToken;
      }
    }

    if (latestToken && !isConnected) {
      connect(latestToken);
    }

    if (!latestToken && isConnected) {
      disconnect();
    }
  }, [connect, disconnect, hasHydrated, isConnected, token]);

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

  const currentUserRole = useMemo(() => {
    if (!user) return null;
    return members.find((m) => m.user_id === user.id)?.role ?? null;
  }, [members, user]);

  const canModerateMessages =
    currentUserRole === "Owner" ||
    currentUserRole === "Admin" ||
    currentUserRole === "Moderator";

  const startEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const saveEdit = async () => {
    if (!activeServerId || !activeChannelId || !editingMessageId) return;

    const content = editingContent.trim();
    if (!content) {
      setError("Le message ne peut pas etre vide.");
      return;
    }

    setSavingEdit(true);
    setError(null);

    try {
      await messagesApi.edit(activeServerId, activeChannelId, editingMessageId, content);

      const channelMessages = wsMessages[activeChannelId] || [];
      const patchedMessages = channelMessages.map((message) =>
        message.id === editingMessageId
          ? {
              ...message,
              content,
              edited_at: new Date().toISOString(),
            }
          : message
      );
      setMessages(activeChannelId, patchedMessages);

      cancelEdit();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSavingEdit(false);
    }
  };

  const setPinLoading = (messageId: string, loading: boolean) => {
    setPinLoadingByMessageId((prev) => ({
      ...prev,
      [messageId]: loading,
    }));
  };

  const loadPinnedMessages = useCallback(async () => {
    if (!activeServerId || !activeChannelId) {
      setPinnedMessagesFromApi([]);
      setPinnedMessagesError(null);
      return;
    }

    setLoadingPinnedMessages(true);
    setPinnedMessagesError(null);
    try {
      const list = await messagesApi.listPinned(activeServerId, activeChannelId, 1, 50);
      setPinnedMessagesFromApi(list);
    } catch (e) {
      setPinnedMessagesError(getErrorMessage(e));
      setPinnedMessagesFromApi([]);
    } finally {
      setLoadingPinnedMessages(false);
    }
  }, [activeChannelId, activeServerId]);

  useEffect(() => {
    void loadPinnedMessages();
  }, [loadPinnedMessages]);

  const togglePin = async (messageId: string, isPinned: boolean) => {
    if (!activeServerId || !activeChannelId) return;

    setPinLoading(messageId, true);
    setError(null);

    try {
      if (isPinned) {
        await messagesApi.unpin(activeServerId, activeChannelId, messageId);
      } else {
        await messagesApi.pin(activeServerId, activeChannelId, messageId);
      }

      const channelMessages = wsMessages[activeChannelId] || [];
      const patchedMessages = channelMessages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              pinned_by: isPinned ? null : user?.id ?? message.pinned_by,
              pinned_at: isPinned ? null : new Date().toISOString(),
            }
          : message
      );
      setMessages(activeChannelId, patchedMessages);
      await loadPinnedMessages();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPinLoading(messageId, false);
    }
  };

  const jumpToMessage = (messageId: string): boolean => {
    if (typeof document === "undefined") return false;
    const element = document.getElementById(`message-${messageId}`);
    if (!element) return false;

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("ring-2", "ring-amber-400", "rounded-md");
    window.setTimeout(() => {
      element.classList.remove("ring-2", "ring-amber-400", "rounded-md");
    }, 1200);
    return true;
  };

  useEffect(() => {
    if (!activeServerId || !activeChannelId) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(null);
      try {
        const result = await messagesApi.search(activeServerId, activeChannelId, query, 1, 30);
        if (!cancelled) {
          setSearchResults(result);
        }
      } catch (e) {
        if (!cancelled) {
          setSearchError(getErrorMessage(e));
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeChannelId, activeServerId, searchQuery]);

  return (
    <div className="h-[95%] rounded-2xl my-4 mx-2 border border-[#E5E7EB] min-w-0 flex flex-col bg-white shadow-lg overflow-hidden">
      {/* --- HEADER --- */}
      <div className="h-12 px-4 flex items-center border-b shadow-sm dark:border-zinc-800 shrink-0 gap-3">
        <span className="text-zinc-500 mr-2 text-2xl">#</span>
        <h2 className="font-bold text-md text-zinc-800 dark:text-zinc-100">
          {activeChannelName ?? "aucun-channel"}
        </h2>

        <div className="ml-auto relative w-72 max-w-[45%]">
          <Search className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un message..."
            className="h-8 pl-9 pr-3 bg-zinc-100 border-zinc-200 text-sm"
            disabled={!canLoad}
          />
        </div>
      </div>

      {canLoad && searchQuery.trim().length >= 2 && (
        <div className="border-b border-indigo-200/70 bg-indigo-50/70 px-4 py-2">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-semibold text-indigo-800">Resultats de recherche</div>
            {searchLoading && <span className="text-[11px] text-indigo-600">Recherche...</span>}
          </div>

          {searchError && (
            <div className="text-[12px] text-red-600">{searchError}</div>
          )}

          {!searchLoading && !searchError && searchResults.length === 0 && (
            <div className="text-[12px] text-zinc-600">Aucun message trouve.</div>
          )}

          {!searchError && searchResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {searchResults.map((message) => (
                <button
                  key={`search-${message.id}`}
                  type="button"
                  onClick={() => {
                    const jumped = jumpToMessage(message.id);
                    if (!jumped) {
                      setError("Message trouve mais absent de l'historique charge.");
                    }
                  }}
                  className="w-full rounded-md border border-indigo-200 bg-white/80 px-2 py-1 text-left text-[12px] text-zinc-700 hover:bg-white"
                  title="Aller au message"
                >
                  <span className="font-semibold text-zinc-800">{getUsernameById(message.author_id, message.username)}</span>
                  <span className="mx-1 text-zinc-400">-</span>
                  <span className="line-clamp-1">{message.content}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {canLoad && pinnedMessages.length > 0 && (
        <div className="border-b border-amber-200/70 bg-amber-50/70 px-4 py-2">
          <div className="mb-2 flex items-center justify-between gap-2 text-[12px] font-semibold text-amber-800">
            <div className="flex items-center gap-2">
              <Pin className="h-3.5 w-3.5" />
              {pinnedMessages.length} message{pinnedMessages.length > 1 ? "s" : ""} epingle
              {pinnedMessages.length > 1 ? "s" : ""}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px]"
              disabled={loadingPinnedMessages}
              onClick={() => setShowPinnedPanel((prev) => !prev)}
            >
              {showPinnedPanel ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Replier
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Afficher
                </>
              )}
            </Button>
          </div>

          {pinnedMessagesError && (
            <div className="mb-2 text-[11px] text-red-600">{pinnedMessagesError}</div>
          )}

          {showPinnedPanel && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {pinnedMessages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => jumpToMessage(message.id)}
                  className="w-full rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-left text-[12px] text-zinc-700 hover:bg-white"
                  title="Aller au message"
                >
                  <span className="font-semibold text-zinc-800">{getUsernameById(message.author_id, message.username)}</span>
                  <span className="mx-1 text-zinc-400">-</span>
                  <span className="line-clamp-1">{message.content}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- MESSAGES --- */}
      <div className="flex-1 overflow-y-auto flex flex-col py-4">
        {!canLoad ? (
          <div className="px-4 text-sm text-muted-foreground">
            Sélectionne un serveur et un channel.
          </div>
        ) : !isConnected ? (
          <div className="px-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {connectionStatusLabel ?? "Connexion au serveur..."}
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
                id={`message-${msg.id}`}
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

                  {editingMessageId === msg.id ? (
                    <div className="mt-2 space-y-2">
                      <Input
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void saveEdit();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEdit();
                          }
                        }}
                        disabled={savingEdit}
                        className="h-9 bg-white"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            void saveEdit();
                          }}
                          disabled={savingEdit || !editingContent.trim()}
                          className="h-8"
                        >
                          {savingEdit ? "..." : "Sauvegarder"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit} className="h-8">
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  )}

                  {(user?.id === msg.author_id || canModerateMessages) && editingMessageId !== msg.id && (
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                      {user?.id === msg.author_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => startEdit(msg.id, msg.content)}
                        >
                          Editer
                        </Button>
                      )}

                      {canModerateMessages && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          disabled={!!pinLoadingByMessageId[msg.id]}
                          onClick={() => {
                            void togglePin(msg.id, !!msg.pinned_at);
                          }}
                        >
                          {pinLoadingByMessageId[msg.id]
                            ? "..."
                            : msg.pinned_at
                            ? "Desepingler"
                            : "Epingler"}
                        </Button>
                      )}
                    </div>
                  )}
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

              <button
                type="button"
                onClick={() => setShowInputEmojis(!showInputEmojis)}
                title="Emojis"
                className="h-6 w-6 flex items-center justify-center"
              >
                <Smile className="h-5 w-5 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer" />
              </button>
              {showInputEmojis && (
                <div className="absolute bottom-10 right-0 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg px-2 py-2 flex flex-wrap gap-1 w-48">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      onClick={() => {
                        setValue((prev) => prev + emoji);
                        setShowInputEmojis(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
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
            {connectionStatusLabel ?? "Reconnexion en cours..."}
          </div>
        )}
      </div>
    </div>
  );
}
