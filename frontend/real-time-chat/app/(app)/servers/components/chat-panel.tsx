"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Smile,
  Gift,
  Sticker,
  Send,
  Loader2,
  CornerUpLeft,
  Edit3,
  Trash2,
  X,
  Search,
} from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { messagesApi } from "@/lib/api";
import type { Message } from "@/lib/api/schemas/messages.schema";
import { useLanguage } from "@/components/language-provider";
import { useAppearanceStore } from "@/store/appearance.store";

const FONT_SIZE_MAP = { sm: "14px", base: "16px", lg: "18px", xl: "20px" } as const;

export function ChatPanel() {
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const channels = useChannelStore((s) => s.channels);
  const activeChannelId = useChannelStore((s) => s.activeChannelId);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);

  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const members = useMemberStore((s) => s.members);
  const fontSize = useAppearanceStore((s) => s.fontSize);
  const chatFontSize = FONT_SIZE_MAP[fontSize] || "16px";
  const { language } = useLanguage();
  const isEnglish = language === "en";

  // WebSocket store
  const isConnected = useWebSocketStore((s) => s.isConnected);
  const connect = useWebSocketStore((s) => s.connect);
  const sendMessage = useWebSocketStore((s) => s.sendMessage);
  const editMessage = useWebSocketStore((s) => s.editMessage);
  const deleteMessage = useWebSocketStore((s) => s.deleteMessage);
  const joinChannel = useWebSocketStore((s) => s.joinChannel);
  const setMessages = useWebSocketStore((s) => s.setMessages);
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
  // Search UI state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      id: string;
      server_id: string;
      channel_id: string;
      author_id: string;
      username: string;
      content: string;
      created_at: string;
    }[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [openGifLightbox, setOpenGifLightbox] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyToUsername, setReplyToUsername] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // GIF picker state
  const [openGifPicker, setOpenGifPicker] = useState<"input" | null>(null);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<
    { id: string; url: string; preview?: string; provider?: string }[]
  >([]);
  const [gifLoading, setGifLoading] = useState(false);

  // Emoji reaction picker state
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmojis, setShowInputEmojis] = useState(false);
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Jump to a message by id (switch server/channel if needed)
  const jumpToMessage = async (
    messageId: string,
    serverId: string,
    channelId: string,
  ) => {
    try {
      // If server or channel differs, set them so the UI switches
      if (serverId && serverId !== activeServerId) {
        setActiveServer(serverId);
      }
      if (channelId && channelId !== activeChannelId) {
        setActiveChannel(channelId);
      }

      // Wait for the DOM element to appear (messages loaded via WS)
      const selector = `#msg-${messageId}`;
      const start = Date.now();
      const timeout = 3000; // ms
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // briefly highlight
          const original = el.style.boxShadow;
          el.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.25)";
          setTimeout(() => {
            el.style.boxShadow = original;
          }, 1600);
          return;
        }
        // wait a bit
        await new Promise((r) => setTimeout(r, 150));
      }
      // If not found, just close search
    } catch (err) {
      console.error("jumpToMessage failed", err);
    }
  };

  const canLoad = !!activeServerId && !!activeChannelId;

  // Get messages for current channel
  const messages = useMemo(() => {
    if (!activeChannelId) return [];
    return wsMessages[activeChannelId] || [];
  }, [activeChannelId, wsMessages]);

  // Debug: log chat state when messages / channel change
  useEffect(() => {
    console.log("📚 ChatPanel state", {
      activeServerId,
      activeChannelId,
      isConnected,
      messageCount: messages.length,
    });
  }, [activeServerId, activeChannelId, isConnected, messages.length]);

  // Connect WebSocket on mount
  useEffect(() => {
    if (token && !isConnected) {
      connect(token);
    }
  }, [token, isConnected, connect]);

  // Join channel & (re)load history when ready and we have no messages yet
  useEffect(() => {
    if (activeChannelId && isConnected && activeServerId) {
      // Load initial history via REST so the UI shows messages immediately on reload
      (async () => {
        try {
          const data = await messagesApi.list(activeServerId, activeChannelId);
          // messagesApi returns Message[] compatible with WsMessage shape
          setMessages(activeChannelId, data as Message[]);
        } catch (err) {
          console.warn("Failed to load initial messages via REST:", err);
        } finally {
          // Then join the WS channel to receive live updates
          joinChannel(activeChannelId);
        }
      })();
    }
  }, [activeChannelId, isConnected, joinChannel, activeServerId, setMessages]);

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

  const parseGifContent = useCallback((content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (
        parsed &&
        parsed.type === "gif" &&
        parsed.gif &&
        typeof parsed.gif.url === "string"
      ) {
        return parsed as {
          type: "gif";
          gif: { id: string; url: string; preview?: string; provider?: string };
          caption?: string;
        };
      }
    } catch {
      // Not JSON
    }
    return null;
  }, []);

  const currentMemberRole = members.find((m) => m.user_id === user?.id)?.role;
  const canModerate =
    currentMemberRole === "Owner" ||
    currentMemberRole === "Admin" ||
    currentMemberRole === "Moderator";

  const onSend = async () => {
    if (!activeChannelId || !canLoad) return;

    const content = value.trim();
    if (!content) return;

    if (!isConnected) {
      setError(isEnglish ? "Not connected to the server" : "Non connecté au serveur");
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
      setError(e instanceof Error ? e.message : isEnglish ? "Error sending message" : "Erreur envoi message");
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
    if (names.length === 1)
      return isEnglish
        ? `${names[0]} is typing...`
        : `${names[0]} est en train d'écrire...`;
    if (names.length === 2)
      return isEnglish
        ? `${names[0]} and ${names[1]} are typing...`
        : `${names[0]} et ${names[1]} écrivent...`;
    return isEnglish
      ? `${names.length} people are typing...`
      : `${names.length} personnes écrivent...`;
  }, [currentTypingUsers, getUsernameById, isEnglish]);

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
    <div className="h-[95%] rounded-2xl my-4 mx-2 border border-[var(--border)] min-w-0 flex flex-col bg-[var(--card)] shadow-lg overflow-hidden">
      {/* --- HEADER --- */}
      <div className="h-12 px-4 flex items-center border-b shadow-sm shrink-0">
        <span className="text-[var(--muted-foreground)] mr-2 text-2xl">#</span>
        <h2 className="font-bold text-md text-[var(--foreground)]">
          {activeChannelName ?? (isEnglish ? "no-channel" : "aucun-channel")}
        </h2>
        <div className="ml-auto relative">
          <button
            title="Rechercher"
            onClick={() => setSearchOpen((s) => !s)}
            className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition ml-3"
          >
            <Search className="h-4 w-4" />
          </button>

          {searchOpen && (
            <div className="absolute right-0 top-10 z-40 bg-white dark:bg-zinc-900 border rounded-md shadow-lg p-3 w-[min(90vw,28rem)]">
              <div className="flex gap-2">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-2 py-1 border rounded bg-zinc-50 dark:bg-zinc-800"
                  placeholder="Rechercher dans ce channel"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void (async () => {
                        if (!activeServerId || !activeChannelId) return;
                        setSearchLoading(true);
                        try {
                          const url = `/api/servers/${activeServerId}/channels/${activeChannelId}/messages/search?q=${encodeURIComponent(
                            searchQuery || "",
                          )}&per_page=12`;
                          // Attach Authorization header from localStorage (client-side)
                          const headers: Record<string, string> = {
                            "Content-Type": "application/json",
                          };
                          try {
                            const localToken =
                              typeof window !== "undefined"
                                ? localStorage.getItem("token")
                                : null;
                            if (localToken)
                              headers["Authorization"] = `Bearer ${localToken}`;
                          } catch {
                            /* ignore */
                          }
                          const res = await fetch(url, { headers });
                          if (!res.ok) {
                            setSearchResults([]);
                            return;
                          }
                          const json = await res.json();
                          setSearchResults(json || []);
                        } catch (err) {
                          console.error("Search failed", err);
                          setSearchResults([]);
                        } finally {
                          setSearchLoading(false);
                        }
                      })();
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (!activeServerId || !activeChannelId) return;
                    setSearchLoading(true);
                    try {
                      const url = `/api/servers/${activeServerId}/channels/${activeChannelId}/messages/search?q=${encodeURIComponent(
                        searchQuery || "",
                      )}&per_page=12`;
                      const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                      };
                      try {
                        const localToken =
                          typeof window !== "undefined"
                            ? localStorage.getItem("token")
                            : null;
                        if (localToken)
                          headers["Authorization"] = `Bearer ${localToken}`;
                      } catch {
                        /* ignore */
                      }
                      const res = await fetch(url, { headers });
                      if (!res.ok) {
                        setSearchResults([]);
                        return;
                      }
                      const json = await res.json();
                      setSearchResults(json || []);
                    } catch (err) {
                      console.error("Search failed", err);
                      setSearchResults([]);
                    } finally {
                      setSearchLoading(false);
                    }
                  }}
                  className="px-2 py-1 bg-indigo-600 text-white rounded"
                >
                  {searchLoading ? "…" : "Go"}
                </button>
              </div>

              <div className="mt-2 max-h-64 overflow-auto">
                {searchResults.length === 0 ? (
                  <div className="text-sm text-zinc-500">Aucun résultat</div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {searchResults.map((r) => (
                      <li
                        key={r.id}
                        className="p-2 border rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        onClick={async () => {
                          // Jump to the message in the conversation
                          setSearchOpen(false);
                          setSearchResults([]);
                          await jumpToMessage(r.id, r.server_id, r.channel_id);
                        }}
                      >
                        <div className="text-xs text-zinc-500">
                          {new Date(r.created_at).toLocaleString()} —{" "}
                          {r.username}
                        </div>
                        <div className="text-sm text-zinc-700 dark:text-zinc-200 truncate">
                          {r.content}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MESSAGES --- */}
      <div className="flex-1 overflow-y-auto flex flex-col py-4">
        {!canLoad ? (
          <div className="px-4 text-sm text-muted-foreground">
            {isEnglish
              ? "Select a server and a channel."
              : "Sélectionne un serveur et un channel."}
          </div>
        ) : messages.length === 0 && !isConnected ? (
          <div className="px-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEnglish ? "Connecting to server..." : "Connexion au serveur..."}
          </div>
        ) : messages.length === 0 ? (
          <div className="px-4 text-sm text-muted-foreground">
            {isEnglish
              ? "No messages in this channel yet. Be the first to write!"
              : "Aucun message dans ce channel. Soyez le premier à écrire !"}
          </div>
        ) : (
          <div className="flex flex-col mt-auto">
            {messages.map((msg) => {
              const isAuthor = user?.id === msg.author_id;
              const canDelete = isAuthor || canModerate;
              const messageUsername = getUsernameById(
                msg.author_id,
                msg.username,
              );
              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className="group relative flex items-start px-4 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition w-full"
                >
                  {/* Action buttons — top-right, visible on hover */}
                  <div className="absolute -top-3 right-4 hidden group-hover:flex items-center gap-0.5 bg-[var(--card)] border border-[var(--border)] rounded-md shadow-sm px-1 py-0.5 z-10">
                    <button
                      className="h-7 w-7 flex items-center justify-center text-[var(--muted-foreground)] hover:text-indigo-600 hover:bg-[var(--surface)] rounded transition"
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
                        className="h-7 w-7 flex items-center justify-center text-[var(--muted-foreground)] hover:text-emerald-600 hover:bg-[var(--surface)] rounded transition"
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
                        className="h-7 w-7 flex items-center justify-center text-zinc-500 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition"
                        onClick={() =>
                          deleteMessage(activeChannelId || "", msg.id)
                        }
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      className="h-7 w-7 flex items-center justify-center text-zinc-500 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition"
                      onClick={() =>
                        setEmojiPickerMsgId(
                          emojiPickerMsgId === msg.id ? null : msg.id,
                        )
                      }
                      title="Réaction"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Quick emoji picker */}
                  {emojiPickerMsgId === msg.id && (
                    <div className="absolute -top-3 right-4 z-20 flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg px-2 py-1">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          className="text-lg hover:scale-125 transition-transform p-0.5"
                          onClick={() => {
                            if (
                              socket &&
                              socket.readyState === WebSocket.OPEN
                            ) {
                              socket.send(
                                JSON.stringify({
                                  type: "ReactionAdd",
                                  payload: { message_id: msg.id, emoji },
                                }),
                              );
                            }
                            setEmojiPickerMsgId(null);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        className="ml-1 text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] text-xs"
                        onClick={() => setEmojiPickerMsgId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="mr-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs font-semibold text-[var(--foreground)]">
                      {messageUsername.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="flex flex-col w-full">
                    <div className="flex items-center gap-x-2">
                      <span className="font-semibold text-sm text-[var(--foreground)]">
                        {messageUsername}
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                      {msg.edited_at && (
                        <span className="text-xs text-indigo-500">(édité)</span>
                      )}
                    </div>

                    {msg.reply_to &&
                      (() => {
                        const original = messages.find(
                          (m) => m.id === msg.reply_to,
                        );
                        return (
                          <div className="text-xs text-zinc-500 italic mb-1 bg-zinc-100 dark:bg-zinc-800 p-2 rounded-md">
                            Réponse à{" "}
                            {original
                              ? getUsernameById(
                                  original.author_id,
                                  original.username,
                                )
                              : msg.reply_to.slice(0, 8)}
                            :
                            <div className="truncate max-w-full">
                              {original
                                ? original.content
                                : "message introuvable"}
                            </div>
                          </div>
                        );
                      })()}

                    {(() => {
                      const gifMessage = parseGifContent(msg.content);
                      if (gifMessage) {
                        return (
                          <div className="mt-2">
                            {/* GIF preview, constrained size; click to open full */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={gifMessage.gif.url}
                              alt={gifMessage.caption || "GIF"}
                              className="max-h-90 max-w-[70%] rounded-md object-contain cursor-pointer"
                              onClick={() =>
                                setOpenGifLightbox(gifMessage.gif.url)
                              }
                            />
                            {gifMessage.caption && (
                              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                                {gifMessage.caption}
                              </p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <p className="text-[var(--muted-foreground)] whitespace-pre-wrap" style={{ fontSize: chatFontSize }}>
                          {msg.content}
                        </p>
                      );
                    })()}

                    {/* Reactions display */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(
                          msg.reactions.reduce<
                            Record<
                              string,
                              {
                                count: number;
                                users: string[];
                                userIds: string[];
                              }
                            >
                          >((acc, r) => {
                            if (!acc[r.emoji])
                              acc[r.emoji] = {
                                count: 0,
                                users: [],
                                userIds: [],
                              };
                            acc[r.emoji].count++;
                            acc[r.emoji].users.push(
                              r.username || r.user_id.slice(0, 6),
                            );
                            acc[r.emoji].userIds.push(r.user_id);
                            return acc;
                          }, {}),
                        ).map(([emoji, data]) => {
                          const hasReacted = data.userIds.includes(
                            user?.id || "",
                          );
                          return (
                            <button
                              key={emoji}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
                                hasReacted
                                  ? "bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-600 dark:text-indigo-300"
                                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                              }`}
                              title={data.users.join(", ")}
                              onClick={() => {
                                if (
                                  socket &&
                                  socket.readyState === WebSocket.OPEN
                                ) {
                                  socket.send(
                                    JSON.stringify({
                                      type: "ReactionAdd",
                                      payload: { message_id: msg.id, emoji },
                                    }),
                                  );
                                }
                              }}
                            >
                              <span>{emoji}</span>
                              <span>{data.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
            {/* GIF lightbox */}
            {openGifLightbox && (
              <div
                className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
                onClick={() => setOpenGifLightbox(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={openGifLightbox}
                  alt="GIF full"
                  className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        )}

        {!isConnected && messages.length > 0 && (
          <div className="px-4 py-1 text-xs text-[var(--muted-foreground)] flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reconnexion en cours...
          </div>
        )}

        {error && <div className="px-4 mt-2 text-xs text-red-500">{error}</div>}
      </div>

      {/* --- INPUT --- */}
      <div className="p-4 mb-2 shrink-0">
        {((replyTo && !isEditing) || isEditing) && (
          <div className="mb-2 rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200 flex items-center justify-between">
            <div>
              {isEditing
                ? "Modification du message en cours"
                : "Réponse en cours"}
              {replyTo && !isEditing && replyToUsername
                ? `: ${replyToUsername}`
                : ""}
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
              className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 bg-[var(--muted-foreground)] hover:bg-[var(--muted-foreground)] transition rounded-full p-1 flex items-center justify-center text-white"
              disabled
              title="Fonction à venir"
            >
              <Plus className="text-white" />
            </button>

            <Input
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!canLoad || sending || !isConnected}
              className="px-14 pr-32 py-6 bg-[var(--muted)] border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
              placeholder={
                !canLoad
                  ? isEnglish
                    ? "Select a channel..."
                    : "Sélectionne un channel..."
                  : !isConnected
                    ? isEnglish
                      ? "Connecting..."
                      : "Connexion en cours..."
                    : isEnglish
                      ? `Send a message in #${activeChannelName ?? ""}`
                      : `Envoyer un message dans #${activeChannelName ?? ""}`
              }
            />

            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-x-3">
              <span title="Fonction à venir">
                <Gift className="h-5 w-5 text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] transition cursor-not-allowed" />
              </span>

              <button
                type="button"
                onClick={() =>
                  setOpenGifPicker(openGifPicker === "input" ? null : "input")
                }
                title="GIF"
                className="h-6 w-6 flex items-center justify-center"
              >
                <Sticker className="h-5 w-5 text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] transition cursor-pointer" />
              </button>

              <button
                type="button"
                onClick={() => setShowInputEmojis(!showInputEmojis)}
                title="Emojis"
                className="h-6 w-6 flex items-center justify-center"
              >
                <Smile className="h-5 w-5 text-[var(--muted-foreground)] hover:text-[var(--muted-foreground)] transition cursor-pointer" />
              </button>
              {showInputEmojis && (
                <div className="absolute bottom-10 right-0 z-50 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg px-2 py-2 flex flex-wrap gap-1 w-48">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-[var(--surface)]"
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
          <div className="absolute left-4 right-4 bottom-20 z-50 bg-[var(--card)] border rounded-lg shadow-md p-3 w-[min(90vw,40rem)]">
            <div className="flex gap-2 mb-2">
              <input
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                placeholder="Recherche de GIFs"
                className="flex-1 px-2 py-1 border rounded bg-[var(--surface)]"
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
                className="px-2 py-1 bg-[var(--muted)] rounded"
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
