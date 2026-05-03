"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Smile,
  Loader2,
  Reply,
  Edit3,
  Trash2,
  X,
  Search,
  Pin,
  PinOff,
  Paperclip,
  FileText,
  Clock3,
  Hash,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { useMessageStore } from "@/store/message.store";
import { messagesApi } from "@/lib/api";
import type { Message } from "@/lib/api/schemas/messages.schema";
import {
  formatScheduledAt,
  getNextWeeklyOccurrenceLocal,
  toBackendUtcSchedule,
} from "@/lib/schedule";
import type { WsMessage } from "@/lib/ws/types";
import { useLanguage } from "@/components/language-provider";
import { useAppearanceStore } from "@/store/appearance.store";
import { toast } from "sonner";

const FONT_SIZE_MAP = { sm: "14px", base: "16px", lg: "18px", xl: "20px" } as const;

type ScheduledPreview = {
  local_id: string;
  channel_id: string;
  content: string;
  scheduled_for: string;
};

const AVATAR_COLORS = [
  { bg: "bg-[#DCE9F8]", text: "text-[#003D82]" },
  { bg: "bg-[#FBE3D6]", text: "text-[#8A3F18]" },
  { bg: "bg-[#DCEFE2]", text: "text-[#1F6B3D]" },
  { bg: "bg-[#E4DEF1]", text: "text-[#4B3A85]" },
  { bg: "bg-[#F4DDE3]", text: "text-[#7B2A45]" },
];

function getAvatarColor(authorId: string) {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) hash = (hash * 31 + authorId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const DAY_ABBR_FR = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const DAY_ABBR_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_ABBR_FR = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];
const MONTH_ABBR_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatDayDivider(dateStr: string, isEnglish: boolean): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msgDate = new Date(date);
  msgDate.setHours(0, 0, 0, 0);
  const dayAbbr = isEnglish ? DAY_ABBR_EN[date.getDay()] : DAY_ABBR_FR[date.getDay()];
  const monthAbbr = isEnglish ? MONTH_ABBR_EN[date.getMonth()] : MONTH_ABBR_FR[date.getMonth()];
  const dayNum = date.getDate();
  if (msgDate.getTime() === today.getTime()) {
    return isEnglish ? `TODAY · ${dayNum} ${monthAbbr}` : `AUJOURD'HUI · ${dayNum} ${monthAbbr}`;
  }
  return `${dayAbbr} · ${dayNum} ${monthAbbr}`;
}

function getRoleBadge(role?: string) {
  if (!role || role === "Member") return null;
  if (role === "Owner" || role === "Admin") {
    return { label: "APE", className: "bg-[#FCEBDF] text-[#8A3F18] border border-[#F1CDB7]" };
  }
  return { label: "PÉDAGO", className: "bg-[#EAF1FB] text-[#003D82] border border-[#BFD3EE]" };
}

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
  const sendScheduledMessage = useWebSocketStore((s) => s.sendScheduledMessage);
  const editMessage = useWebSocketStore((s) => s.editMessage);
  const deleteMessage = useWebSocketStore((s) => s.deleteMessage);
  const joinChannel = useWebSocketStore((s) => s.joinChannel);
  const socket = useWebSocketStore((s) => s.socket);
  const startTyping = useWebSocketStore((s) => s.startTyping);
  const stopTyping = useWebSocketStore((s) => s.stopTyping);
  const typingUsers = useWebSocketStore((s) => s.typingUsers);

  // Message store (source of truth)
  const messagesByChannel = useMessageStore((s) => s.messages);
  const setMsgs = useMessageStore((s) => s.setMessages);
  const prependMessages = useMessageStore((s) => s.prependMessages);
  const setCursor = useMessageStore((s) => s.setCursor);
  const clearChannel = useMessageStore((s) => s.clearChannel);

  const activeChannelName = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId)?.name ?? null;
  }, [channels, activeChannelId]);

  const activeChannelTopic = useMemo(() => {
    return (channels.find((c) => c.id === activeChannelId) as any)?.topic ?? null;
  }, [channels, activeChannelId]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  // Pinned messages panel state
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);

  const loadPinnedMessages = async () => {
    if (!activeServerId || !activeChannelId) return;
    setPinnedLoading(true);
    try {
      const data = await messagesApi.listPinned(activeServerId, activeChannelId);
      setPinnedMessages(data);
    } catch (err) {
      console.error("Failed to load pinned messages:", err);
      setError(isEnglish ? "Unable to load pinned messages" : "Impossible de charger les messages épinglés");
    } finally {
      setPinnedLoading(false);
    }
  };

  const handlePin = async (messageId: string) => {
    if (!activeServerId || !activeChannelId) return;
    try {
      setError(null);
      await messagesApi.pin(activeServerId, activeChannelId, messageId);
      await loadPinnedMessages();
      toast.success(isEnglish ? "Message pinned" : "Message épinglé");
    } catch (err) {
      console.error("Failed to pin message:", err);
      setError(isEnglish ? "You do not have permission to pin messages" : "Vous n'avez pas la permission d'épingler des messages");
      toast.error(isEnglish ? "Pin failed" : "Échec de l'épinglage");
    }
  };

  const handleUnpin = async (messageId: string) => {
    if (!activeServerId || !activeChannelId) return;
    try {
      setError(null);
      await messagesApi.unpin(activeServerId, activeChannelId, messageId);
      await loadPinnedMessages();
      toast.success(isEnglish ? "Message unpinned" : "Message désépinglé");
    } catch (err) {
      console.error("Failed to unpin message:", err);
      setError(isEnglish ? "You do not have permission to unpin messages" : "Vous n'avez pas la permission de désépingler des messages");
      toast.error(isEnglish ? "Unpin failed" : "Échec du désépinglage");
    }
  };

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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDay, setScheduleDay] = useState("1");
  const [scheduleHour, setScheduleHour] = useState("9");
  const [scheduleMinute, setScheduleMinute] = useState("0");
  const [, setScheduledByChannel] = useState<
    Record<string, ScheduledPreview[]>
  >({});
  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // distance from bottom saved before prepend, restored via useLayoutEffect
  const scrollAnchorRef = useRef<number | null>(null);
  const prevChannelRef = useRef<string | null>(null);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Jump to a message by id (switch server/channel if needed)
  const jumpToMessage = async (
    messageId: string,
    serverId: string,
    channelId: string,
  ) => {
    try {
      if (serverId && serverId !== activeServerId) {
        setActiveServer(serverId);
      }
      if (channelId && channelId !== activeChannelId) {
        setActiveChannel(channelId);
      }

      const selector = `#msg-${messageId}`;
      const start = Date.now();
      const timeout = 3000;
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const original = el.style.boxShadow;
          el.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.25)";
          setTimeout(() => {
            el.style.boxShadow = original;
          }, 1600);
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (err) {
      console.error("jumpToMessage failed", err);
    }
  };

  useEffect(() => {
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const { messageId } = event.detail ?? {};
      if (messageId && activeServerId && activeChannelId) {
        void jumpToMessage(messageId, activeServerId, activeChannelId);
      }
    };
    window.addEventListener("notification:scroll-to-message", handler);
    return () => window.removeEventListener("notification:scroll-to-message", handler);
  }, [activeServerId, activeChannelId, jumpToMessage]);

  const canLoad = !!activeServerId && !!activeChannelId;

  const messages = useMemo(() => {
    if (!activeChannelId) return [];
    return messagesByChannel[activeChannelId] ?? [];
  }, [activeChannelId, messagesByChannel]);

  const dayOptions = useMemo(
    () => [
      { value: "1", label: isEnglish ? "Monday" : "Lundi" },
      { value: "2", label: isEnglish ? "Tuesday" : "Mardi" },
      { value: "3", label: isEnglish ? "Wednesday" : "Mercredi" },
      { value: "4", label: isEnglish ? "Thursday" : "Jeudi" },
      { value: "5", label: isEnglish ? "Friday" : "Vendredi" },
      { value: "6", label: isEnglish ? "Saturday" : "Samedi" },
      { value: "7", label: isEnglish ? "Sunday" : "Dimanche" },
    ],
    [isEnglish],
  );

  const schedulePreviewLabel = useMemo(() => {
    const now = new Date();
    const day = Number(scheduleDay);
    const hour = Number(scheduleHour);
    const minute = Number(scheduleMinute);
    const next = getNextWeeklyOccurrenceLocal(now, day, hour, minute);
    if (!next) {
      return isEnglish ? "Invalid date/time" : "Date/heure invalide";
    }
    return formatScheduledAt(next, isEnglish ? "en" : "fr");
  }, [isEnglish, scheduleDay, scheduleHour, scheduleMinute]);

  useEffect(() => {
    console.log("📚 ChatPanel state", {
      activeServerId,
      activeChannelId,
      isConnected,
      messageCount: messages.length,
    });
  }, [activeServerId, activeChannelId, isConnected, messages.length]);

  useEffect(() => {
    if (token && !isConnected) {
      connect(token);
    }
  }, [token, isConnected, connect]);

  useEffect(() => {
    if (!isConnected || !activeChannelId) return;
    joinChannel(activeChannelId);
  }, [isConnected, activeChannelId, joinChannel]);

  useEffect(() => {
    if (!activeChannelId || !isConnected || !activeServerId) return;

    const prevChannel = prevChannelRef.current;
    if (prevChannel && prevChannel !== activeChannelId) {
      clearChannel(prevChannel);
    }
    prevChannelRef.current = activeChannelId;

    setHasMore(true);
    setLoadingMore(false);

    const cached = useMessageStore.getState().getMessages(activeChannelId);
    if (cached.length === 0) {
      void (async () => {
        try {
          const data = await messagesApi.list(activeServerId, activeChannelId);
          setMsgs(activeChannelId, data as WsMessage[]);
          if (data.length > 0) setCursor(activeChannelId, data[0].id);
          setHasMore(data.length >= 50);
        } catch (err) {
          console.warn("Failed to load initial messages:", err);
        } finally {
          joinChannel(activeChannelId);
        }
      })();
    } else {
      joinChannel(activeChannelId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId, isConnected, activeServerId]);

  useEffect(() => {
    if (scrollAnchorRef.current !== null) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useLayoutEffect(() => {
    if (scrollAnchorRef.current === null) return;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight - scrollAnchorRef.current;
    scrollAnchorRef.current = null;
  }, [messages]);

  const loadOlderMessages = useCallback(async () => {
    if (!activeServerId || !activeChannelId || !hasMore || loadingMore) return;
    const msgs = useMessageStore.getState().getMessages(activeChannelId);
    if (!msgs.length) return;

    const el = scrollContainerRef.current;
    if (el) scrollAnchorRef.current = el.scrollHeight - el.scrollTop;

    setLoadingMore(true);
    try {
      const data = await messagesApi.list(activeServerId, activeChannelId, {
        before: msgs[0].id,
      });
      if (data.length > 0) {
        prependMessages(activeChannelId, data as WsMessage[]);
        setCursor(activeChannelId, data[0].id);
      }
      if (data.length < 50) setHasMore(false);
    } catch (err) {
      console.warn("Failed to load older messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [activeServerId, activeChannelId, hasMore, loadingMore, prependMessages, setCursor]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (e.currentTarget.scrollTop < 150 && hasMore && !loadingMore) {
        void loadOlderMessages();
      }
    },
    [hasMore, loadingMore, loadOlderMessages],
  );

  const getUsernameById = useCallback(
    (authorId: string, msgUsername?: string): string => {
      if (msgUsername) return msgUsername;
      if (user && user.id === authorId) {
        return user.username;
      }
      const member = members.find((m) => m.user_id === authorId);
      if (member) {
        return member.username;
      }
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
    console.log("🔵 [onSend] Called:", { activeChannelId, canLoad, activeServerId });
    if (!activeChannelId || !canLoad) {
      console.error("❌ [onSend] Blocked - activeChannelId:", activeChannelId, "canLoad:", canLoad);
      return;
    }

    const content = value.trim();
    if (!content && !attachmentFile) {
      console.log("⚠️ [onSend] Empty content and no attachment");
      return;
    }

    if (!isConnected) {
      setError(isEnglish ? "Not connected to the server" : "Non connecté au serveur");
      return;
    }

    setSending(true);
    setError(null);

    try {
      let attachmentUrl: string | undefined;
      if (attachmentFile && activeServerId) {
        const result = await messagesApi.uploadAttachment(activeServerId, activeChannelId, attachmentFile);
        attachmentUrl = result.url;
      }

      if (isEditing && editingMessageId) {
        editMessage(activeChannelId, editingMessageId, content);
        setEditingMessageId(null);
        setIsEditing(false);
      } else if (scheduleOpen) {
        const day = Number(scheduleDay);
        const hour = Number(scheduleHour);
        const minute = Number(scheduleMinute);

        if (!(day >= 1 && day <= 7 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) {
          setError(
            isEnglish
              ? "Invalid schedule values (day 1-7, hour 0-23, minute 0-59)."
              : "Valeurs de planification invalides (jour 1-7, heure 0-23, minute 0-59).",
          );
          return;
        }

        const nextAt = getNextWeeklyOccurrenceLocal(new Date(), day, hour, minute);
        if (!nextAt) {
          setError(
            isEnglish
              ? "Unable to compute next schedule slot."
              : "Impossible de calculer le prochain envoi programme.",
          );
          return;
        }

        const backendUtcSchedule = toBackendUtcSchedule(nextAt);

        sendScheduledMessage(
          activeChannelId,
          content,
          backendUtcSchedule.dayOfWeek,
          backendUtcSchedule.hour,
          backendUtcSchedule.minute,
          replyTo || undefined,
        );
        setScheduledByChannel((prev) => {
          const current = prev[activeChannelId] || [];
          return {
            ...prev,
            [activeChannelId]: [
              ...current,
              {
                local_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                channel_id: activeChannelId,
                content,
                scheduled_for: nextAt.toISOString(),
              },
            ],
          };
        });
        setReplyTo(null);
        setReplyToUsername(null);
        setScheduleOpen(false);
      } else {
        console.log("🔵 [onSend] About to call sendMessage:", { activeChannelId, content: content.substring(0, 50), replyTo, attachmentUrl });
        sendMessage(activeChannelId, content, replyTo || undefined, attachmentUrl);
        setReplyTo(null);
        setReplyToUsername(null);
        setAttachmentFile(null);
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
    setAttachmentFile(null);
  };

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      if (!activeChannelId || !isConnected) return;

      if (newValue.trim()) {
        startTyping(activeChannelId);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
          setError(isEnglish ? "GIF service is currently unavailable" : "Le service GIF est indisponible actuellement");
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
        if (!(err instanceof DOMException) || err.name !== "AbortError") {
          console.error("GIF search failed", err);
          setError(isEnglish ? "GIF search failed" : "La recherche GIF a échoué");
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

  const doSearch = async () => {
    if (!activeServerId || !activeChannelId) return;
    setSearchLoading(true);
    try {
      const url = `/api/servers/${activeServerId}/channels/${activeChannelId}/messages/search?q=${encodeURIComponent(
        searchQuery || "",
      )}&per_page=12`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const localToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (localToken) headers["Authorization"] = `Bearer ${localToken}`;
      } catch { /* ignore */ }
      const res = await fetch(url, { headers });
      if (!res.ok) { setSearchResults([]); return; }
      const json = await res.json();
      setSearchResults(json || []);
      setSearchOpen(true);
    } catch (err) {
      console.error("Search failed", err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full bg-white overflow-hidden">
      {/* --- HEADER --- */}
      <div className="h-14 flex items-center gap-3 px-6 border-b border-[#D5DAE0] shrink-0">
        {/* Left: channel name + topic */}
        <div className="flex items-center gap-3 min-w-0">
          <Hash className="w-4.5 h-4.5 text-[#8A929C] shrink-0" />
          <span className="text-[15px] font-semibold text-[#003D82] whitespace-nowrap">
            {activeChannelName ?? (isEnglish ? "no-channel" : "aucun-channel")}
          </span>
          {activeChannelTopic && (
            <>
              <div className="w-px h-5 bg-[#D5DAE0] mx-1 shrink-0" />
              <span className="text-[13px] text-[#6B737D] truncate">{activeChannelTopic}</span>
            </>
          )}
        </div>

        {/* Right: search bar + pin + more */}
        <div className="ml-auto flex items-center gap-1.5 relative shrink-0">
          {/* Inline search bar */}
          <div className="flex items-center gap-2 h-8 px-3 rounded bg-[#FAFBFC] border border-[#D5DAE0] focus-within:border-[#4A9EFF] focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] transition-shadow">
            <Search className="w-3.5 h-3.5 text-[#8A929C] shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none w-44 text-[13px] text-[#333333] placeholder:text-[#8A929C]"
              placeholder={`Rechercher dans #${activeChannelName ?? ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") void doSearch();
                if (e.key === "Escape") { setSearchOpen(false); setSearchResults([]); }
              }}
            />
            {searchLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8A929C] shrink-0" />}
          </div>

          {/* Pin button */}
          <button
            title={isEnglish ? "Pinned messages" : "Messages épinglés"}
            onClick={() => {
              setPinnedOpen((s) => !s);
              if (!pinnedOpen) loadPinnedMessages();
            }}
            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${pinnedOpen ? "text-[#0066CC] bg-[#E6F0FB]" : "text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1]"}`}
          >
            <Pin className="w-4 h-4" />
          </button>

          {/* Pinned panel dropdown */}
          {pinnedOpen && (
            <div className="absolute right-0 top-10 z-40 bg-white border border-[#D5DAE0] rounded-md shadow-lg p-3 w-[min(90vw,28rem)]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-[#333333]">
                  {isEnglish ? "Pinned messages" : "Messages épinglés"}
                </span>
                <button onClick={() => setPinnedOpen(false)} className="text-[#8A929C] hover:text-[#333333]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {pinnedLoading ? (
                <div className="flex items-center gap-2 text-sm text-[#6B737D] py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
                </div>
              ) : pinnedMessages.length === 0 ? (
                <div className="text-sm text-[#6B737D]">
                  {isEnglish ? "No pinned messages." : "Aucun message épinglé."}
                </div>
              ) : (
                <ul className="flex flex-col gap-2 max-h-72 overflow-auto">
                  {pinnedMessages.map((m) => (
                    <li
                      key={m.id}
                      className="p-2 border border-[#D5DAE0] rounded hover:bg-[#FAFBFC] cursor-pointer"
                      onClick={async () => {
                        setPinnedOpen(false);
                        await jumpToMessage(m.id, activeServerId ?? "", m.channel_id);
                      }}
                    >
                      <div className="text-xs text-[#8A929C] mb-0.5">
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                      <div className="text-sm text-[#333333] truncate">{m.content}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* More button */}
          <button
            className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {/* Search results dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute right-0 top-10 z-40 bg-white border border-[#D5DAE0] rounded-md shadow-lg p-3 w-[min(90vw,28rem)]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-[#333333]">Résultats</span>
                <button onClick={() => { setSearchOpen(false); setSearchResults([]); }} className="text-[#8A929C] hover:text-[#333333]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-64 overflow-auto">
                <ul className="flex flex-col gap-2">
                  {searchResults.map((r) => (
                    <li
                      key={r.id}
                      className="p-2 border border-[#D5DAE0] rounded hover:bg-[#FAFBFC] cursor-pointer"
                      onClick={async () => {
                        setSearchOpen(false);
                        setSearchResults([]);
                        await jumpToMessage(r.id, r.server_id, r.channel_id);
                      }}
                    >
                      <div className="text-xs text-[#8A929C]">
                        {new Date(r.created_at).toLocaleString()} — {r.username}
                      </div>
                      <div className="text-sm text-[#333333] truncate">{r.content}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MESSAGES --- */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col py-3"
        onScroll={handleScroll}
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#8A929C]" />
          </div>
        )}
        {!canLoad ? (
          <div className="px-6 text-sm text-[#6B737D]">
            {isEnglish
              ? "Select a server and a channel."
              : "Sélectionne un serveur et un channel."}
          </div>
        ) : messages.length === 0 && !isConnected ? (
          <div className="px-6 text-sm text-[#6B737D] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isEnglish ? "Connecting to server..." : "Connexion au serveur..."}
          </div>
        ) : messages.length === 0 ? (
          <div className="px-6 text-sm text-[#6B737D]">
            {isEnglish
              ? "No messages in this channel yet. Be the first to write!"
              : "Aucun message dans ce channel. Soyez le premier à écrire !"}
          </div>
        ) : (
          <div className="flex flex-col mt-auto">
            {messages.map((msg, index) => {
              const isAuthor = user?.id === msg.author_id;
              const canDelete = isAuthor || canModerate;
              const messageUsername = getUsernameById(msg.author_id, msg.username);
              const avatarColor = getAvatarColor(msg.author_id);
              const memberRole = members.find((m) => m.user_id === msg.author_id)?.role;
              const roleBadge = getRoleBadge(memberRole);

              // Day divider
              const msgDay = new Date(msg.created_at).toDateString();
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const prevDay = prevMsg ? new Date(prevMsg.created_at).toDateString() : null;
              const showDivider = msgDay !== prevDay;

              // Compact mode: same author, within 5 minutes
              const isCompact =
                !!prevMsg &&
                prevMsg.author_id === msg.author_id &&
                !showDivider &&
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;

              return (
                <div key={msg.id}>
                  {/* Day divider */}
                  {showDivider && (
                    <div className="flex items-center gap-3 px-6 py-2">
                      <div className="flex-1 h-px bg-[#E1E5EA]" />
                      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] flex-shrink-0">
                        {formatDayDivider(msg.created_at, isEnglish)}
                      </span>
                      <div className="flex-1 h-px bg-[#E1E5EA]" />
                    </div>
                  )}

                  {/* Message row */}
                  <div
                    id={`msg-${msg.id}`}
                    className="group relative flex gap-3 px-6 py-2.5 hover:bg-[#FAFBFC] transition-colors w-full"
                  >
                    {/* Action buttons */}
                    <div className="absolute right-4 -top-2 flex items-center gap-0.5 bg-white border border-[#D5DAE0] rounded shadow-[0_2px_8px_rgba(15,24,40,0.06)] p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-120 z-10">
                      <button
                        className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                        onClick={() =>
                          setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)
                        }
                        title="Réagir"
                      >
                        <Smile size={14} />
                      </button>
                      <button
                        className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                        onClick={() => {
                          setReplyTo(msg.id);
                          setReplyToUsername(messageUsername);
                          setValue("");
                        }}
                        title="Répondre"
                      >
                        <Reply size={14} />
                      </button>
                      {canModerate && (
                        <button
                          className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                          onClick={() =>
                            msg.pinned_at ? handleUnpin(msg.id) : handlePin(msg.id)
                          }
                          title={msg.pinned_at ? (isEnglish ? "Unpin" : "Désépingler") : (isEnglish ? "Pin" : "Épingler")}
                        >
                          {msg.pinned_at ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                      )}
                      {isAuthor && (
                        <button
                          className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                          onClick={() => {
                            setIsEditing(true);
                            setEditingMessageId(msg.id);
                            setValue(msg.content);
                          }}
                          title="Modifier"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                          onClick={() => deleteMessage(activeChannelId || "", msg.id)}
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button
                        className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                        title="Plus"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </div>

                    {/* Quick emoji picker */}
                    {emojiPickerMsgId === msg.id && (
                      <div className="absolute -top-3 right-4 z-20 flex items-center gap-1 bg-white border border-[#D5DAE0] rounded-lg shadow-lg px-2 py-1">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            className="text-lg hover:scale-125 transition-transform p-0.5"
                            onClick={() => {
                              if (socket && socket.readyState === WebSocket.OPEN) {
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
                          className="ml-1 text-[#8A929C] hover:text-[#333333]"
                          onClick={() => setEmojiPickerMsgId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Avatar or spacer for compact */}
                    {isCompact ? (
                      <div className="w-9 shrink-0" />
                    ) : (() => {
                      const rawAvatarUrl =
                        user?.id === msg.author_id
                          ? user?.avatar_url
                          : members.find((m) => m.user_id === msg.author_id)?.avatar_url;
                      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
                      const authorAvatarUrl = rawAvatarUrl
                        ? rawAvatarUrl.startsWith("/") ? `${base}${rawAvatarUrl}` : rawAvatarUrl
                        : null;
                      return (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-mono font-semibold shrink-0 overflow-hidden ${authorAvatarUrl ? "" : `${avatarColor.bg} ${avatarColor.text}`}`}>
                          {authorAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={authorAvatarUrl} alt={messageUsername} className="w-full h-full object-cover rounded-full" />
                          ) : (
                            messageUsername.slice(0, 2).toUpperCase()
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex flex-col flex-1 min-w-0">
                      {/* Header (hidden in compact) */}
                      {!isCompact && (
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[14px] font-semibold text-[#003D82]">
                            {messageUsername}
                          </span>
                          {roleBadge && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${roleBadge.className}`}>
                              {roleBadge.label}
                            </span>
                          )}
                          <span className="text-[12px] font-mono text-[#8A929C]">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {msg.edited_at && (
                            <span className="text-xs text-[#8A929C]">(édité)</span>
                          )}
                          {msg.pinned_at && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                              <Pin className="h-3 w-3" />
                              {isEnglish ? "pinned" : "épinglé"}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reply thread */}
                      {msg.reply_to &&
                        (() => {
                          const original = messages.find((m) => m.id === msg.reply_to);
                          return (
                            <div className="text-xs text-[#6B737D] italic mb-1 bg-[#F5F7FA] p-2 rounded-md max-h-16 overflow-hidden">
                              Réponse à{" "}
                              {original
                                ? getUsernameById(original.author_id, original.username)
                                : msg.reply_to.slice(0, 8)}
                              :
                              <div className="truncate max-w-full">
                                {original
                                  ? original.content.startsWith('{"type":"gif"')
                                    ? "GIF"
                                    : original.content
                                  : "message introuvable"}
                              </div>
                            </div>
                          );
                        })()}

                      {/* Message body */}
                      {(() => {
                        const gifMessage = parseGifContent(msg.content);
                        if (gifMessage) {
                          return (
                            <div className="mt-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={gifMessage.gif.url}
                                alt={gifMessage.caption || "GIF"}
                                className="max-h-90 max-w-[70%] rounded-md object-contain cursor-pointer"
                                onClick={() => setOpenGifLightbox(gifMessage.gif.url)}
                              />
                              {gifMessage.caption && (
                                <p className="mt-1 text-sm text-[#6B737D]">{gifMessage.caption}</p>
                              )}
                            </div>
                          );
                        }

                        return (
                          <>
                            {msg.content && (
                              <p className="text-[#333333] leading-5.5 whitespace-pre-wrap" style={{ fontSize: chatFontSize }}>
                                {msg.content}
                              </p>
                            )}
                            {msg.attachment_url && (() => {
                              const raw = msg.attachment_url!;
                              const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
                              const url = raw.startsWith("http") ? raw : `${base}${raw}`;
                              const isImage = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(raw);
                              if (isImage) {
                                return (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt="attachment"
                                    className="mt-2 max-w-xs max-h-64 rounded-md object-contain cursor-pointer"
                                    onClick={() => setOpenGifLightbox(url)}
                                  />
                                );
                              }
                              const filename = raw.split("/").pop() ?? raw;
                              const displayName = filename.length > 30 ? `${filename.slice(0, 30)}...` : filename;
                              return (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="mt-2 inline-flex items-center gap-2 text-sm text-[#003D82] hover:underline"
                                >
                                  <FileText className="h-4 w-4 shrink-0" />
                                  {displayName}
                                </a>
                              );
                            })()}
                          </>
                        );
                      })()}

                      {/* Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {Object.entries(
                            msg.reactions.reduce<
                              Record<string, { count: number; users: string[]; userIds: string[] }>
                            >((acc, r) => {
                              if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], userIds: [] };
                              acc[r.emoji].count++;
                              acc[r.emoji].users.push(r.username || r.user_id.slice(0, 6));
                              acc[r.emoji].userIds.push(r.user_id);
                              return acc;
                            }, {}),
                          ).map(([emoji, data]) => {
                            const hasReacted = data.userIds.includes(user?.id || "");
                            return (
                              <button
                                key={emoji}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition ${
                                  hasReacted
                                    ? "bg-[#EAF1FB] border-[#BFD3EE] text-[#003D82]"
                                    : "bg-[#F5F7FA] border-[#D5DAE0] text-[#6B737D] hover:bg-[#ECEEF1]"
                                }`}
                                title={data.users.join(", ")}
                                onClick={() => {
                                  if (socket && socket.readyState === WebSocket.OPEN) {
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
          <div className="px-6 py-1 text-xs text-[#6B737D] flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reconnexion en cours...
          </div>
        )}

        {error && <div className="px-6 mt-2 text-xs text-red-500">{error}</div>}
      </div>

      {/* --- COMPOSER --- */}
      <div className="px-6 pb-5 pt-3 shrink-0">
        {((replyTo && !isEditing) || isEditing) && (
          <div className="mb-2 rounded-md border border-[#D5DAE0] bg-[#F5F7FA] p-2 text-xs text-[#6B737D] flex items-center justify-between">
            <div>
              {isEditing
                ? "Modification du message en cours"
                : "Réponse en cours"}
              {replyTo && !isEditing && replyToUsername ? `: ${replyToUsername}` : ""}
            </div>
            <button
              className="text-[#8A929C] hover:text-[#333333] text-xs flex items-center gap-1"
              onClick={cancelPendingAction}
            >
              <X className="h-3 w-3" /> Annuler
            </button>
          </div>
        )}

        {/* Attachment preview */}
        {attachmentFile && (
          <div className="mb-2 flex items-center gap-3 px-3 py-2 rounded-lg border border-[#D5DAE0] bg-[#F5F7FA] text-sm">
            {attachmentFile.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={URL.createObjectURL(attachmentFile)}
                alt="preview"
                className="h-16 w-16 rounded object-cover shrink-0"
              />
            ) : (
              <FileText className="h-8 w-8 text-[#003D82] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-[#333333]">{attachmentFile.name}</p>
              <p className="text-xs text-[#6B737D]">
                {attachmentFile.size < 1024 * 1024
                  ? `${(attachmentFile.size / 1024).toFixed(1)} KB`
                  : `${(attachmentFile.size / (1024 * 1024)).toFixed(1)} MB`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAttachmentFile(null)}
              className="text-[#8A929C] hover:text-red-500 transition shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 10 * 1024 * 1024) {
                setError(isEnglish ? "File must be under 10 MB" : "Le fichier doit faire moins de 10 Mo");
                return;
              }
              setAttachmentFile(file);
            }
            e.target.value = "";
          }}
        />

        <div className="border border-[#D5DAE0] rounded-lg bg-white focus-within:border-[#B8BFC7] focus-within:shadow-[0_0_0_3px_#ECEEF1] overflow-hidden transition-shadow">
          <Input
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!canLoad || sending}
            className="w-full px-4 pt-3 pb-2 text-[15px] text-[#333333] bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[#8A929C]"
            placeholder={
              !canLoad
                ? isEnglish ? "Select a channel..." : "Sélectionne un channel..."
                : isEnglish
                  ? `Message #${activeChannelName ?? ""}`
                  : `Message #${activeChannelName ?? ""}`
            }
          />

          <div className="flex items-center px-3 pb-2 border-t border-[#ECEEF1] pt-2">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={isEnglish ? "Attach a file" : "Joindre un fichier"}
                className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setOpenGifPicker(openGifPicker === "input" ? null : "input")}
                title="GIF"
                className="w-9 h-7 rounded flex items-center justify-center text-[11px] font-semibold font-mono text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
              >
                GIF
              </button>

              <button
                type="button"
                onClick={() => setShowInputEmojis(!showInputEmojis)}
                title="Emojis"
                className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
              >
                <Smile className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setScheduleOpen((v) => !v)}
                title={isEnglish ? "Schedule weekly message" : "Programmer un message hebdomadaire"}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  scheduleOpen
                    ? "text-amber-600 bg-amber-50"
                    : "text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1]"
                }`}
              >
                <Clock3 className="w-4 h-4" />
              </button>
            </div>

            {/* Send button */}
            <Button
              onClick={onSend}
              disabled={!canLoad || sending || !isConnected || (!value.trim() && !attachmentFile)}
              className="ml-auto flex items-center gap-1.5 h-7 px-3 rounded bg-[#FF6B35] text-white text-[13px] font-medium hover:bg-[#E55A26] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={
                scheduleOpen
                  ? isEnglish ? "Schedule the message" : "Programmer le message"
                  : isEnglish ? "Send message" : "Envoyer le message"
              }
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <><Send className="w-3.5 h-3.5" /> {isEnglish ? "Send" : "Envoyer"}</>
              )}
            </Button>
          </div>

          {showInputEmojis && (
            <div className="border-t border-[#ECEEF1] bg-white px-2 py-2 flex flex-wrap gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-[#ECEEF1]"
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

        {/* Tips */}
        <div className="mt-1.5 flex items-center gap-4 text-[11px] text-[#8A929C]">
          <span><kbd className="font-mono bg-[#ECEEF1] px-1 rounded text-[10px] text-[#6B737D]">↵</kbd> {isEnglish ? "send" : "envoyer"}</span>
          <span><kbd className="font-mono bg-[#ECEEF1] px-1 rounded text-[10px] text-[#6B737D]">⇧↵</kbd> {isEnglish ? "new line" : "nouvelle ligne"}</span>
          <span><kbd className="font-mono bg-[#ECEEF1] px-1 rounded text-[10px] text-[#6B737D]">/</kbd> {isEnglish ? "commands" : "commandes"}</span>
          <span><kbd className="font-mono bg-[#ECEEF1] px-1 rounded text-[10px] text-[#6B737D]">@</kbd> {isEnglish ? "mention" : "mentionner"}</span>
        </div>

        {scheduleOpen && (
          <div className="mt-2 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 flex flex-wrap items-end gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <label>{isEnglish ? "Day" : "Jour"}</label>
              <select
                value={scheduleDay}
                onChange={(e) => setScheduleDay(e.target.value)}
                className="w-44 rounded border border-[#D5DAE0] bg-white px-2 py-1"
              >
                {dayOptions.map((day) => (
                  <option key={day.value} value={day.value}>{day.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label>{isEnglish ? "Hour" : "Heure"}</label>
              <select
                value={scheduleHour}
                onChange={(e) => setScheduleHour(e.target.value)}
                className="w-20 rounded border border-[#D5DAE0] bg-white px-2 py-1"
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour} value={String(hour)}>
                    {hour.toString().padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label>{isEnglish ? "Minute" : "Minute"}</label>
              <select
                value={scheduleMinute}
                onChange={(e) => setScheduleMinute(e.target.value)}
                className="w-20 rounded border border-[#D5DAE0] bg-white px-2 py-1"
              >
                {Array.from({ length: 60 }, (_, minute) => (
                  <option key={minute} value={String(minute)}>
                    {minute.toString().padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-[#6B737D] flex-1 min-w-52">
              {isEnglish
                ? "The receiver will only see it when the scheduled time arrives."
                : "Le destinataire le verra seulement a l'heure programmee."}
              <div className="mt-1 text-[#333333] font-medium">
                {isEnglish ? "Preview (local time):" : "Apercu (heure locale) :"} {schedulePreviewLabel}
              </div>
            </div>
          </div>
        )}

        {/* GIF picker */}
        {openGifPicker === "input" && (
          <div className="absolute left-4 right-4 bottom-20 z-50 bg-white border border-[#D5DAE0] rounded-lg shadow-md p-3 w-[min(90vw,40rem)]">
            <div className="flex gap-2 mb-2">
              <input
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                placeholder="Recherche de GIFs"
                className="flex-1 px-2 py-1 border border-[#D5DAE0] rounded bg-[#FAFBFC] text-[13px] outline-none focus:border-[#4A9EFF]"
              />
              <button
                onClick={async () => {
                  setGifLoading(true);
                  try {
                    const res = await fetch(
                      `/api/gifs/search?q=${encodeURIComponent(gifQuery || "trending")}&limit=24`,
                    );
                    if (!res.ok) {
                      setGifResults([]);
                      setGifLoading(false);
                      setError(isEnglish ? "GIF service is currently unavailable" : "Le service GIF est indisponible actuellement");
                      toast.error(isEnglish ? "GIF service unavailable" : "Service GIF indisponible");
                      return;
                    }
                    const json = await res.json();
                    const results: { id: string; url: string; preview?: string; provider?: string }[] = [];
                    if (json.results) {
                      for (const it of json.results) {
                        const id = it.id || "";
                        const url = it.url || "";
                        const preview = it.preview || undefined;
                        const provider = it.provider || undefined;
                        if (url) results.push({ id: id.toString(), url, preview, provider });
                      }
                    } else if (json.data) {
                      for (const it of json.data) {
                        const id = it.id || "";
                        const url = it.images?.original?.url || it.images?.fixed_width?.url || "";
                        const preview = it.images?.preview_gif?.url || it.images?.fixed_width_small_still?.url;
                        if (url) results.push({ id: id.toString(), url, preview, provider: "giphy" });
                      }
                    }
                    setGifResults(results);
                  } catch (err) {
                    console.error("GIF search failed", err);
                    setGifResults([]);
                    setError(isEnglish ? "GIF search failed" : "La recherche GIF a échoué");
                    toast.error(isEnglish ? "GIF search failed" : "Recherche GIF échouée");
                  } finally {
                    setGifLoading(false);
                  }
                }}
                className="px-2 py-1 bg-[#003D82] text-white rounded text-[13px]"
                disabled={gifLoading}
              >
                {gifLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
              </button>
              <button
                onClick={() => { setOpenGifPicker(null); setGifResults([]); setGifQuery(""); }}
                className="px-2 py-1 bg-[#ECEEF1] rounded text-[13px] text-[#333333]"
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
                      if (socket && socket.readyState === WebSocket.OPEN && activeChannelId) {
                        const ev = {
                          type: "MessageSendGif",
                          payload: {
                            channel_id: activeChannelId,
                            gif: { id: g.id, url: g.url, preview: g.preview, provider: g.provider },
                            caption: null,
                          },
                        };
                        socket.send(JSON.stringify(ev));
                      }
                    } catch (e) {
                      console.error("Failed to send gif", e);
                      setError("Erreur lors de l'envoi du GIF");
                      toast.error(isEnglish ? "Failed to send GIF" : "Échec de l'envoi du GIF");
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
          <div className="mt-1 px-1 text-xs text-[#003D82] flex items-center gap-1 animate-pulse">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-[#4A9EFF] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-[#4A9EFF] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-[#4A9EFF] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
