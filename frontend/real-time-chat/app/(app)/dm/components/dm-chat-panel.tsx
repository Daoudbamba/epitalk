"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Paperclip,
  FileText,
  Smile,
  Send,
  Loader2,
  Reply,
  Edit3,
  Trash2,
  X,
  ArrowLeft,
  Search,
  Phone,
  Video,
  MoreHorizontal,
  MessageSquare,
  Clock,
  Pin,
} from "lucide-react";
import { useWebSocketStore, type WsMessage } from "@/store/websocket.store";
import { useAuthStore } from "@/store/auth.store";
import { useDmStore } from "@/store/dm.store";
import { usePresenceStore } from "@/store/presence.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { dmApi } from "@/lib/api";
import type { DmConversation } from "@/lib/api/dm.api";

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
    : "http://localhost:3001";

function prefixBackendUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

const FONT_SIZE_MAP = { sm: "14px", base: "16px", lg: "18px", xl: "20px" } as const;

const AVATAR_COLORS = [
  { bg: "bg-[#DCE9F8]", text: "text-[#003D82]" },
  { bg: "bg-[#FBE3D6]", text: "text-[#8A3F18]" },
  { bg: "bg-[#DCEFE2]", text: "text-[#1F6B3D]" },
  { bg: "bg-[#E4DEF1]", text: "text-[#4B3A85]" },
  { bg: "bg-[#F4DDE3]", text: "text-[#7B2A45]" },
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const DAY_ABBR_FR = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const MONTH_ABBR_FR = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOÛ", "SEP", "OCT", "NOV", "DÉC"];

function formatDayDivider(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const msgDate = new Date(date);
  msgDate.setHours(0, 0, 0, 0);
  const dayAbbr = DAY_ABBR_FR[date.getDay()];
  const monthAbbr = MONTH_ABBR_FR[date.getMonth()];
  const dayNum = date.getDate();
  if (msgDate.getTime() === today.getTime()) {
    return `AUJOURD'HUI · ${dayNum} ${monthAbbr}`;
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (msgDate.getTime() === yesterday.getTime()) {
    return `HIER · ${dayNum} ${monthAbbr}`;
  }
  return `${dayAbbr} · ${dayNum} ${monthAbbr}`;
}

function dmConversationId(a: string, b: string): string {
  return a < b ? `dm:${a}:${b}` : `dm:${b}:${a}`;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

export function DmChatPanel() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const activePeerId = useDmStore((s) => s.activePeerId);
  const setActivePeer = useDmStore((s) => s.setActivePeer);
  const conversations = useDmStore((s) => s.conversations);

  const presence = usePresenceStore((s) => s.presence);

  const isConnected = useWebSocketStore((s) => s.isConnected);
  const connect = useWebSocketStore((s) => s.connect);
  const sendDm = useWebSocketStore((s) => s.sendDm);
  const editDm = useWebSocketStore((s) => s.editDm);
  const deleteDm = useWebSocketStore((s) => s.deleteDm);
  const sendDmGif = useWebSocketStore((s) => s.sendDmGif);
  const joinDm = useWebSocketStore((s) => s.joinDm);
  const leaveDm = useWebSocketStore((s) => s.leaveDm);
  const socket = useWebSocketStore((s) => s.socket);
  const startTyping = useWebSocketStore((s) => s.startTyping);
  const stopTyping = useWebSocketStore((s) => s.stopTyping);
  const typingUsers = useWebSocketStore((s) => s.typingUsers);

  const dmMessagesByConv = useDmStore((s) => s.dmMessages);
  const setDmMsgs = useDmStore((s) => s.setDmMessages);
  const prependDmMsgs = useDmStore((s) => s.prependDmMessages);
  const setDmCursor = useDmStore((s) => s.setDmCursor);
  const clearDmMessages = useDmStore((s) => s.clearDmMessages);
  const fontSize = useAppearanceStore((s) => s.fontSize);
  const chatFontSize = FONT_SIZE_MAP[fontSize] || "16px";

  const conversationId = useMemo(() => {
    if (!user || !activePeerId) return null;
    return dmConversationId(user.id, activePeerId);
  }, [user, activePeerId]);

  const peerUsername = useMemo(() => {
    if (!activePeerId) return null;
    const conv = conversations.find((c) => c.peer_id === activePeerId);
    return conv?.peer_username ?? activePeerId.slice(0, 8);
  }, [activePeerId, conversations]);

  const peerStatus = activePeerId ? (presence?.[activePeerId]?.status ?? "offline") : "offline";
  const peerAvatarColor = activePeerId ? getAvatarColor(activePeerId) : AVATAR_COLORS[0];
  const peerAvatarUrl = useMemo(() => {
    if (!activePeerId) return null;
    const conv = conversations.find((c) => c.peer_id === activePeerId) as
      | (DmConversation & { peer_avatar_url?: string | null })
      | undefined;
    return prefixBackendUrl(conv?.peer_avatar_url);
  }, [activePeerId, conversations]);

  const allMessages: WsMessage[] = useMemo(() => {
    if (!conversationId) return [];
    const list = dmMessagesByConv[conversationId] ?? [];
    return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [conversationId, dmMessagesByConv]);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allMessages
      .filter((m) => {
        if (m.content.startsWith('{"type":"gif"')) return false;
        return m.content.toLowerCase().includes(q);
      })
      .slice(-20)
      .reverse();
  }, [searchQuery, allMessages]);

  const messages = allMessages;

  // ── Composer state ─────────────────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyToUsername, setReplyToUsername] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [showInputEmojis, setShowInputEmojis] = useState(false);

  // ── GIF ────────────────────────────────────────────────────────────────────
  const [openGifLightbox, setOpenGifLightbox] = useState<string | null>(null);
  const [openGifPicker, setOpenGifPicker] = useState<"input" | null>(null);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<
    { id: string; url: string; preview?: string; provider?: string }[]
  >([]);
  const [gifLoading, setGifLoading] = useState(false);

  // ── Scroll ─────────────────────────────────────────────────────────────────
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<number | null>(null);
  const prevPeerRef = useRef<string | null>(null);

  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Typing ─────────────────────────────────────────────────────────────────
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── WebSocket connect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (token && !isConnected) connect(token);
  }, [token, isConnected, connect]);

  // ── Peer change: leave old, fetch + join new ───────────────────────────────
  // Single effect handles both initial load AND reconnection (isConnected dep).
  // Do NOT add a separate effect that also calls joinDm — it causes duplicates.
  useEffect(() => {
    const prevPeer = prevPeerRef.current;
    if (prevPeer && prevPeer !== activePeerId) {
      leaveDm(prevPeer);
      if (user) clearDmMessages(dmConversationId(user.id, prevPeer));
    }
    prevPeerRef.current = activePeerId;

    if (!activePeerId || !isConnected || !user) return;

    const convId = dmConversationId(user.id, activePeerId);
    setHasMore(true);
    setLoadingMore(false);

    const cached = useDmStore.getState().getDmMessages(convId);
    if (cached.length === 0) {
      void (async () => {
        try {
          const data = await dmApi.listMessages(activePeerId);
          const wsMsgs: WsMessage[] = data.map((m) => ({
            id: m.id,
            channel_id: m.conversation_id,
            author_id: m.author_id,
            username: m.username,
            content: m.content,
            created_at: m.created_at,
            reply_to: m.reply_to,
            attachment_url: m.attachment_url,
          }));
          setDmMsgs(convId, wsMsgs);
          if (wsMsgs.length > 0) setDmCursor(convId, wsMsgs[0].id);
          setHasMore(data.length >= 50);
        } catch (err) {
          console.warn("Failed to load DM history:", err);
        } finally {
          joinDm(activePeerId);
        }
      })();
    } else {
      joinDm(activePeerId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeerId, isConnected]);

  // ── Scroll to bottom ───────────────────────────────────────────────────────
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

  // ── Infinite scroll up ─────────────────────────────────────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (!activePeerId || !user || !hasMore || loadingMore) return;
    const convId = dmConversationId(user.id, activePeerId);
    const msgs = useDmStore.getState().getDmMessages(convId);
    if (!msgs.length) return;

    const el = scrollContainerRef.current;
    if (el) scrollAnchorRef.current = el.scrollHeight - el.scrollTop;

    setLoadingMore(true);
    try {
      const data = await dmApi.listMessages(activePeerId, { before: msgs[0].id });
      if (data.length > 0) {
        const wsMsgs: WsMessage[] = data.map((m) => ({
          id: m.id,
          channel_id: m.conversation_id,
          author_id: m.author_id,
          username: m.username,
          content: m.content,
          created_at: m.created_at,
          reply_to: m.reply_to,
        }));
        prependDmMsgs(convId, wsMsgs);
        setDmCursor(convId, wsMsgs[0].id);
      }
      if (data.length < 50) setHasMore(false);
    } catch (err) {
      console.warn("Failed to load older DM messages:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [activePeerId, user, hasMore, loadingMore, prependDmMsgs, setDmCursor]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (e.currentTarget.scrollTop < 150 && hasMore && !loadingMore) {
        void loadOlderMessages();
      }
    },
    [hasMore, loadingMore, loadOlderMessages],
  );

  // ── GIF search ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (openGifPicker !== "input") return;
    const query = gifQuery.trim() || "trending";
    const controller = new AbortController();
    setGifLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/gifs/search?q=${encodeURIComponent(query)}&limit=24`,
          { signal: controller.signal },
        );
        if (!res.ok) { setGifResults([]); setGifLoading(false); return; }
        const json = await res.json();
        const results: { id: string; url: string; preview?: string; provider?: string }[] = [];
        if (json.results) {
          for (const it of json.results) {
            const url = it.url || "";
            if (url) results.push({ id: String(it.id || ""), url, preview: it.preview, provider: it.provider });
          }
        } else if (json.data) {
          for (const it of json.data) {
            const url = it.images?.original?.url || it.images?.fixed_width?.url || "";
            if (url) results.push({
              id: String(it.id || ""),
              url,
              preview: it.images?.preview_gif?.url || it.images?.fixed_width_small_still?.url,
              provider: "giphy",
            });
          }
        }
        setGifResults(results);
      } catch (err: unknown) {
        if (!(err instanceof DOMException) || err.name !== "AbortError") console.error("GIF search failed", err);
        setGifResults([]);
      } finally {
        setGifLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [gifQuery, openGifPicker]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getUsernameById = useCallback(
    (authorId: string, msgUsername?: string): string => {
      if (msgUsername) return msgUsername;
      if (user && user.id === authorId) return user.username;
      if (activePeerId === authorId && peerUsername) return peerUsername;
      return authorId.slice(0, 8);
    },
    [user, activePeerId, peerUsername],
  );

  const parseGifContent = useCallback((content: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === "gif" && parsed?.gif?.url) {
        return parsed as {
          type: "gif";
          gif: { id: string; url: string; preview?: string; provider?: string };
          caption?: string;
        };
      }
    } catch { /* not JSON */ }
    return null;
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const onSend = async () => {
    if (!activePeerId || !conversationId) return;
    const content = value.trim();
    if (!content && !attachmentFile) return;
    if (!isConnected) { setError("Non connecté au serveur"); return; }

    setSending(true);
    setError(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (conversationId) stopTyping(conversationId);

    try {
      let attachmentUrl: string | undefined;
      if (attachmentFile) {
        const result = await dmApi.uploadAttachment(attachmentFile);
        attachmentUrl = result.url;
      }
      if (isEditing && editingMessageId) {
        editDm(conversationId, editingMessageId, content);
        setEditingMessageId(null);
        setIsEditing(false);
      } else {
        sendDm(activePeerId, content, replyTo || undefined, attachmentUrl);
        setReplyTo(null);
        setReplyToUsername(null);
        setAttachmentFile(null);
      }
      setValue("");
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
    setAttachmentFile(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (!conversationId) return;
    startTyping(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => stopTyping(conversationId), 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // ── Status helpers ─────────────────────────────────────────────────────────
  const statusDot = peerStatus === "online" ? "bg-[#2BAE5C]"
    : peerStatus === "dnd" ? "bg-[#D93F3F]"
    : "bg-[#8A929C]";

  const statusLabel = peerStatus === "online" ? "En ligne"
    : peerStatus === "dnd" ? "Ne pas déranger"
    : "Hors ligne";

  const statusTextColor = peerStatus === "online" ? "text-[#2BAE5C]"
    : peerStatus === "dnd" ? "text-[#D93F3F]"
    : "text-[#8A929C]";

  // Typing display: use conversationId as the "channel" key
  const dmTypingUsers: string[] = conversationId ? (typingUsers[conversationId] ?? []) : [];
  const otherTyping = dmTypingUsers.filter((u) => u !== user?.username);

  // ── Search: jump to message ─────────────────────────────────────────────────
  const jumpToMessage = (messageId: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setTimeout(() => {
      const el = document.querySelector(`#dm-msg-${messageId}`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const prev = el.style.boxShadow;
        el.style.boxShadow = "0 0 0 3px rgba(0,102,204,0.25)";
        setTimeout(() => { el.style.boxShadow = prev; }, 1600);
      }
    }, 50);
  };

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!activePeerId) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <MessageSquare size={48} className="text-[#E1E5EA]" />
          <p className="text-[16px] font-medium text-[#8A929C]">Sélectionne une conversation</p>
          <p className="text-[13px] text-[#B8BFC7]">ou commence un nouveau message</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="h-14 flex items-center gap-3 px-6 border-b border-[#D5DAE0] shrink-0">
        <button
          className="md:hidden mr-1 text-[#8A929C] hover:text-[#333333] transition-colors"
          onClick={() => setActivePeer(null)}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-mono font-semibold overflow-hidden ${peerAvatarUrl ? "" : `${peerAvatarColor.bg} ${peerAvatarColor.text}`}`}>
              {peerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={peerAvatarUrl} alt={peerUsername ?? ""} className="w-full h-full object-cover rounded-full" />
              ) : (
                (peerUsername ?? "?").slice(0, 2).toUpperCase()
              )}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white ${statusDot}`} />
          </div>

          <div>
            <div className="text-[15px] font-semibold text-[#003D82]">{peerUsername}</div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${statusDot}`} />
              <span className={`text-[12px] ${statusTextColor}`}>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0 relative">
          {/* Search bar */}
          <div className="flex items-center gap-2 h-8 px-3 rounded bg-[#FAFBFC] border border-[#D5DAE0] focus-within:border-[#4A9EFF] focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] transition-shadow">
            <Search className="w-3.5 h-3.5 text-[#8A929C] shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(e.target.value.trim().length > 0);
              }}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); } }}
              className="bg-transparent outline-none w-40 text-[13px] text-[#333333] placeholder:text-[#8A929C]"
              placeholder={`Rechercher avec ${peerUsername ?? ""}`}
            />
          </div>

          {/* Search results dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute right-0 top-10 z-40 bg-white border border-[#D5DAE0] rounded-md shadow-lg p-3 w-[min(90vw,28rem)]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-[13px] text-[#333333]">
                  {searchResults.length} résultat{searchResults.length > 1 ? "s" : ""}
                </span>
                <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="text-[#8A929C] hover:text-[#333333]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="flex flex-col gap-1.5 max-h-64 overflow-auto">
                {searchResults.map((r) => (
                  <li
                    key={r.id}
                    className="p-2 border border-[#D5DAE0] rounded hover:bg-[#FAFBFC] cursor-pointer"
                    onClick={() => jumpToMessage(r.id)}
                  >
                    <div className="text-[11px] font-mono text-[#8A929C] mb-0.5">
                      {getUsernameById(r.author_id, r.username)} · {new Date(r.created_at).toLocaleString()}
                    </div>
                    <div className="text-[13px] text-[#333333] truncate">{r.content}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
            <div className="absolute right-0 top-10 z-40 bg-white border border-[#D5DAE0] rounded-md shadow-lg p-4 text-[13px] text-[#8A929C] w-52">
              Aucun résultat
            </div>
          )}

          <button className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] opacity-40 cursor-not-allowed" disabled>
            <Phone className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] opacity-40 cursor-not-allowed" disabled>
            <Video className="w-4 h-4" />
          </button>
          <button className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── MESSAGES ───────────────────────────────────────────────────────── */}
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

        {messages.length === 0 && !isConnected ? (
          <div className="px-6 text-[13px] text-[#8A929C] flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connexion au serveur...
          </div>
        ) : messages.length === 0 ? (
          <div className="px-6 text-[13px] text-[#8A929C]">
            Aucun message. Écris le premier à {peerUsername} !
          </div>
        ) : (
          <div className="flex flex-col mt-auto">
            {messages.map((msg, index) => {
              const isAuthor = user?.id === msg.author_id;
              const messageUsername = getUsernameById(msg.author_id, msg.username);
              const avatarColor = getAvatarColor(msg.author_id);

              // Day divider
              const msgDay = new Date(msg.created_at).toDateString();
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const prevDay = prevMsg ? new Date(prevMsg.created_at).toDateString() : null;
              const showDivider = msgDay !== prevDay;

              // Compact mode: same author, within 5 min, no divider
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
                      <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] shrink-0">
                        {formatDayDivider(msg.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-[#E1E5EA]" />
                    </div>
                  )}

                  {/* Message row */}
                  <div
                    id={`dm-msg-${msg.id}`}
                    className="group relative flex gap-3 px-6 py-1.5 hover:bg-[#FAFBFC] transition-colors w-full"
                  >
                    {/* Hover action bar */}
                    <div className="absolute right-4 -top-2 flex items-center gap-0.5 bg-white border border-[#D5DAE0] rounded shadow-[0_2px_8px_rgba(15,24,40,0.06)] p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-120 z-10">
                      <button
                        className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                        onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)}
                        title="Réagir"
                      >
                        <Smile size={14} />
                      </button>
                      <button
                        className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                        onClick={() => {
                          setReplyTo(msg.id);
                          setReplyToUsername(messageUsername);
                          setIsEditing(false);
                          setEditingMessageId(null);
                          setValue("");
                        }}
                        title="Répondre"
                      >
                        <Reply size={14} />
                      </button>
                      {isAuthor && (
                        <button
                          className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                          onClick={() => {
                            setIsEditing(true);
                            setEditingMessageId(msg.id);
                            setReplyTo(null);
                            setReplyToUsername(null);
                            setValue(msg.content);
                          }}
                          title="Modifier"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      {isAuthor && conversationId && (
                        <button
                          className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333]"
                          onClick={() => deleteDm(conversationId, msg.id)}
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
                                socket.send(JSON.stringify({ type: "ReactionAdd", payload: { message_id: msg.id, emoji } }));
                              }
                              setEmojiPickerMsgId(null);
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button className="ml-1 text-[#8A929C] hover:text-[#333333]" onClick={() => setEmojiPickerMsgId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Avatar or compact spacer */}
                    {isCompact ? (
                      <div className="w-9 shrink-0" />
                    ) : (() => {
                      const msgAvatarUrl = isAuthor
                        ? prefixBackendUrl(user?.avatar_url)
                        : peerAvatarUrl;
                      return (
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-mono font-semibold shrink-0 overflow-hidden ${msgAvatarUrl ? "" : `${avatarColor.bg} ${avatarColor.text}`}`}>
                          {msgAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={msgAvatarUrl} alt={messageUsername} className="w-full h-full object-cover rounded-full" />
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
                          <span className="text-[14px] font-semibold text-[#003D82]">{messageUsername}</span>
                          <span className="text-[12px] font-mono text-[#8A929C]">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {msg.edited_at && (
                            <span className="text-[11px] text-[#8A929C] italic">(édité)</span>
                          )}
                          {msg.pinned_at && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600">
                              <Pin className="h-3 w-3" /> épinglé
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reply quote */}
                      {msg.reply_to && (() => {
                        const original = messages.find((m) => m.id === msg.reply_to);
                        return (
                          <div className="text-[12px] text-[#6B737D] italic mb-1 bg-[#F5F7FA] border-l-2 border-l-[#D5DAE0] p-2 rounded-r-md max-h-16 overflow-hidden">
                            ↩ {original ? getUsernameById(original.author_id, original.username) : msg.reply_to.slice(0, 8)} :{" "}
                            <span className="not-italic truncate">
                              {original
                                ? original.content.startsWith('{"type":"gif"') ? "🖼 GIF" : original.content
                                : "message introuvable"}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Body */}
                      {(() => {
                        const gifMsg = parseGifContent(msg.content);
                        if (gifMsg) {
                          return (
                            <div className="mt-1.5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={gifMsg.gif.url}
                                alt={gifMsg.caption || "GIF"}
                                className="max-h-60 max-w-[70%] rounded-md object-contain cursor-pointer"
                                onClick={() => setOpenGifLightbox(gifMsg.gif.url)}
                              />
                              {gifMsg.caption && <p className="mt-1 text-[13px] text-[#6B737D]">{gifMsg.caption}</p>}
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
                                  <img src={url} alt="attachment"
                                    className="mt-2 max-w-xs max-h-64 rounded-md object-contain cursor-pointer"
                                    onClick={() => setOpenGifLightbox(url)}
                                  />
                                );
                              }
                              const filename = raw.split("/").pop() ?? raw;
                              const displayName = filename.length > 30 ? `${filename.slice(0, 30)}…` : filename;
                              return (
                                <a href={url} target="_blank" rel="noopener noreferrer" download
                                  className="mt-2 inline-flex items-center gap-2 text-[13px] text-[#003D82] hover:underline"
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
                            msg.reactions.reduce<Record<string, { count: number; users: string[]; userIds: string[] }>>((acc, r) => {
                              if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], userIds: [] };
                              acc[r.emoji].count++;
                              acc[r.emoji].users.push(r.username || r.user_id.slice(0, 6));
                              acc[r.emoji].userIds.push(r.user_id);
                              return acc;
                            }, {})
                          ).map(([emoji, data]) => {
                            const hasReacted = data.userIds.includes(user?.id || "");
                            return (
                              <button
                                key={emoji}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                                  hasReacted
                                    ? "bg-[#EAF1FB] border-[#BFD3EE] text-[#003D82]"
                                    : "bg-[#F5F7FA] border-[#D5DAE0] text-[#6B737D] hover:bg-[#ECEEF1]"
                                }`}
                                title={data.users.join(", ")}
                                onClick={() => {
                                  if (socket && socket.readyState === WebSocket.OPEN) {
                                    socket.send(JSON.stringify({ type: "ReactionAdd", payload: { message_id: msg.id, emoji } }));
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
              <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setOpenGifLightbox(null)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={openGifLightbox} alt="GIF full"
                  className="max-h-[90vh] max-w-[90vw] object-contain rounded-md shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        )}

        {/* Typing indicator */}
        {otherTyping.length > 0 && (
          <div className="px-6 py-1 text-[12px] text-[#8A929C] flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8A929C] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#8A929C] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#8A929C] animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            <span>
              {otherTyping.length === 1
                ? `${otherTyping[0]} est en train d'écrire…`
                : `${otherTyping.join(", ")} écrivent…`}
            </span>
          </div>
        )}

        {!isConnected && messages.length > 0 && (
          <div className="px-6 py-1 text-[12px] text-[#6B737D] flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reconnexion en cours...
          </div>
        )}
        {error && <div className="px-6 mt-2 text-[12px] text-red-500">{error}</div>}
      </div>

      {/* ── COMPOSER ───────────────────────────────────────────────────────── */}
      <div className="px-6 pb-5 pt-3 shrink-0">
        {((replyTo && !isEditing) || isEditing) && (
          <div className="mb-2 rounded-md border border-[#D5DAE0] bg-[#F5F7FA] p-2 text-[12px] text-[#6B737D] flex items-center justify-between">
            <div>
              {isEditing ? "Modification du message en cours" : `Réponse à ${replyToUsername ?? ""}`}
            </div>
            <button className="text-[#8A929C] hover:text-[#333333] flex items-center gap-1" onClick={cancelPendingAction}>
              <X className="h-3 w-3" /> Annuler
            </button>
          </div>
        )}

        {attachmentFile && (
          <div className="mb-2 flex items-center gap-3 px-3 py-2 rounded-lg border border-[#D5DAE0] bg-[#F5F7FA] text-[13px]">
            {attachmentFile.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={URL.createObjectURL(attachmentFile)} alt="preview" className="h-16 w-16 rounded object-cover shrink-0" />
            ) : (
              <FileText className="h-8 w-8 text-[#003D82] shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-[#333333]">{attachmentFile.name}</p>
              <p className="text-[12px] text-[#6B737D]">
                {attachmentFile.size < 1024 * 1024
                  ? `${(attachmentFile.size / 1024).toFixed(1)} KB`
                  : `${(attachmentFile.size / (1024 * 1024)).toFixed(1)} MB`}
              </p>
            </div>
            <button type="button" onClick={() => setAttachmentFile(null)} className="text-[#8A929C] hover:text-red-500 transition shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" className="hidden"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 10 * 1024 * 1024) { setError("Le fichier doit faire moins de 10 Mo"); return; }
              setAttachmentFile(file);
            }
            e.target.value = "";
          }}
        />

        {/* Input area — same structure as channel chat panel */}
        <div className="border border-[#D5DAE0] rounded-lg bg-white focus-within:border-[#B8BFC7] focus-within:shadow-[0_0_0_3px_#ECEEF1] overflow-hidden transition-shadow">
          <Input
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!activePeerId || sending}
            className="w-full px-4 pt-3 pb-2 text-[15px] text-[#333333] bg-transparent border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[#8A929C]"
            placeholder={`Message à @${peerUsername ?? ""}`}
          />

          <div className="flex items-center justify-between px-3 pb-2 border-t border-[#ECEEF1] pt-2">
            {/* Left toolbar */}
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => fileInputRef.current?.click()} title="Joindre un fichier"
                className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button type="button" onClick={() => setOpenGifPicker(openGifPicker === "input" ? null : "input")} title="GIF"
                className="w-9 h-7 rounded flex items-center justify-center text-[11px] font-semibold font-mono text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
              >
                GIF
              </button>

              <div className="relative">
                <button type="button" onClick={() => setShowInputEmojis(!showInputEmojis)} title="Emojis"
                  className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {showInputEmojis && (
                  <div className="absolute bottom-9 left-0 z-50 bg-white border border-[#D5DAE0] rounded-lg shadow-lg px-2 py-2 flex flex-wrap gap-1 w-48">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button key={emoji} className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-[#F5F7FA]"
                        onClick={() => { setValue((prev) => prev + emoji); setShowInputEmojis(false); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button type="button" title="Message programmé (bientôt)" disabled
                className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] opacity-40 cursor-not-allowed"
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>

            {/* Send button */}
            <Button
              onClick={onSend}
              disabled={!activePeerId || sending || !isConnected || (!value.trim() && !attachmentFile)}
              className="h-8 px-3 bg-[#0066CC] hover:bg-[#0057AF] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed gap-1.5 text-[13px] font-medium"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Send className="h-3.5 w-3.5" /> Envoyer</>}
            </Button>
          </div>
        </div>

        {/* GIF picker */}
        {openGifPicker === "input" && (
          <div className="mt-2 z-50 bg-white border border-[#D5DAE0] rounded-lg shadow-md p-3">
            <div className="flex gap-2 mb-2">
              <input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)}
                placeholder="Recherche de GIFs"
                className="flex-1 px-2 py-1 border border-[#D5DAE0] rounded text-[13px] bg-[#F5F7FA] outline-none focus:border-[#0066CC]"
              />
              <button onClick={async () => {
                setGifLoading(true);
                try {
                  const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(gifQuery || "trending")}&limit=24`);
                  if (!res.ok) { setGifResults([]); return; }
                  const json = await res.json();
                  const results: { id: string; url: string; preview?: string; provider?: string }[] = [];
                  if (json.results) {
                    for (const it of json.results) {
                      const url = it.url || "";
                      if (url) results.push({ id: String(it.id || ""), url, preview: it.preview, provider: it.provider });
                    }
                  } else if (json.data) {
                    for (const it of json.data) {
                      const url = it.images?.original?.url || it.images?.fixed_width?.url || "";
                      if (url) results.push({ id: String(it.id || ""), url, preview: it.images?.preview_gif?.url, provider: "giphy" });
                    }
                  }
                  setGifResults(results);
                } catch { setGifResults([]); } finally { setGifLoading(false); }
              }} className="px-3 py-1 bg-[#0066CC] text-white rounded text-[13px] hover:bg-[#0057AF]" disabled={gifLoading}>
                {gifLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rechercher"}
              </button>
              <button onClick={() => { setOpenGifPicker(null); setGifResults([]); setGifQuery(""); }}
                className="px-2 py-1 bg-[#F5F7FA] border border-[#D5DAE0] rounded text-[13px] text-[#8A929C] hover:bg-[#ECEEF1]"
              >
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2 max-h-52 overflow-auto">
              {gifResults.map((g) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={g.id} src={g.preview || g.url} alt="gif"
                  className="h-20 w-full object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    try {
                      if (activePeerId) sendDmGif(activePeerId, { id: g.id, url: g.url, preview: g.preview, provider: g.provider }, null);
                    } catch { setError("Erreur lors de l'envoi du GIF"); }
                    finally { setOpenGifPicker(null); setGifResults([]); setGifQuery(""); }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {!isConnected && (
          <div className="mt-2 text-[12px] text-[#F59E0B] flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reconnexion en cours…
          </div>
        )}
      </div>
    </div>
  );
}
