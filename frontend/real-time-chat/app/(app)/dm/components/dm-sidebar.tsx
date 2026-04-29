"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDmStore } from "@/store/dm.store";
import { usePresenceStore } from "@/store/presence.store";
import { MessageSquare, Edit3, Search, Image, Paperclip, UserPlus, Home } from "lucide-react";
import type { DmConversation } from "@/lib/api/dm.api";

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
    : "http://localhost:3001";

function prefixBackendUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

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

function presenceDotClass(status: string) {
  if (status === "online") return "bg-[#2BAE5C]";
  if (status === "dnd") return "bg-[#D93F3F]";
  return "bg-[#8A929C]";
}

function getExcerpt(lastMessage: string): { type: "gif" | "file" | "text"; text: string } {
  try {
    const p = JSON.parse(lastMessage);
    if (p?.type === "gif") return { type: "gif", text: "GIF" };
  } catch { /* not JSON */ }
  if (lastMessage.startsWith("/attach:") || lastMessage.startsWith("http")) {
    const ext = lastMessage.split(".").pop()?.toLowerCase() ?? "";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return { type: "gif", text: "Image" };
    return { type: "file", text: "Fichier" };
  }
  return { type: "text", text: lastMessage };
}

export function DmSidebar() {
  const router = useRouter();
  const conversations = useDmStore((s) => s.conversations);
  const activePeerId = useDmStore((s) => s.activePeerId);
  const setActivePeer = useDmStore((s) => s.setActivePeer);
  const fetchConversations = useDmStore((s) => s.fetchConversations);
  const loading = useDmStore((s) => s.loading);
  const presence = usePresenceStore((s) => s.presence);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <aside className="h-full flex flex-col bg-[#F5F5F5]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#D5DAE0] shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[#0066CC]" />
          <span className="text-[15px] font-semibold text-[#003D82]">Messages privés</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push("/servers")}
            title="Retour aux serveurs"
            className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#0066CC] transition-colors"
          >
            <Home size={15} />
          </button>
          <button className="w-7 h-7 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#ECEEF1] hover:text-[#333333] transition-colors">
            <Edit3 size={16} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 py-3 shrink-0">
        <div className="flex items-center gap-2 h-9 px-3 rounded bg-white border border-[#D5DAE0] focus-within:border-[#0066CC] transition-colors">
          <Search size={14} className="text-[#8A929C] shrink-0" />
          <input
            className="bg-transparent outline-none flex-1 text-[13px] text-[#333333] placeholder:text-[#8A929C]"
            placeholder="Rechercher une conversation"
          />
        </div>
      </div>

      {/* Conversations label */}
      <div className="px-4 mb-1 shrink-0">
        <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
          Conversations · {conversations.length}
        </span>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {loading && conversations.length === 0 && (
          <div className="px-4 py-8 text-[13px] text-[#8A929C] text-center">
            Chargement...
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="px-4 py-8 text-[13px] text-[#8A929C] text-center">
            Aucune conversation privée.
            <br />
            <span className="text-[12px]">
              Envoie un message à un membre depuis un serveur.
            </span>
          </div>
        )}

        {conversations.map((conv) => {
          const active = conv.peer_id === activePeerId;
          const status = presence?.[conv.peer_id]?.status ?? "offline";
          const color = getAvatarColor(conv.peer_id);
          const excerpt = getExcerpt(conv.last_message);
          const unread = (conv as DmConversation & { unread_count?: number }).unread_count ?? 0;
          const peerAvatarUrl = prefixBackendUrl(
            (conv as DmConversation & { peer_avatar_url?: string | null }).peer_avatar_url,
          );

          return (
            <button
              key={conv.conversation_id}
              onClick={() => setActivePeer(conv.peer_id)}
              className={[
                "group w-full flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors duration-120",
                active
                  ? "bg-[#E6F0FB] border-l-2 border-l-[#0066CC]"
                  : "hover:bg-[#ECEEF1] border-l-2 border-l-transparent",
              ].join(" ")}
            >
              {/* Avatar with presence dot */}
              <div className="relative w-9 h-9 shrink-0">
                <div
                  className={[
                    "w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-mono font-semibold overflow-hidden",
                    !peerAvatarUrl ? color.bg : "",
                    !peerAvatarUrl ? color.text : "",
                  ].join(" ")}
                >
                  {peerAvatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={peerAvatarUrl} alt={conv.peer_username} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    conv.peer_username.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div
                  className={[
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#F5F5F5]",
                    presenceDotClass(status),
                  ].join(" ")}
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="text-[14px] font-medium text-[#333333] truncate">
                    {conv.peer_username}
                  </span>
                  {conv.last_message_at && (
                    <span className="text-[12px] font-mono text-[#8A929C] shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center mt-0.5 gap-1">
                  <span className="text-[13px] text-[#8A929C] truncate flex-1 flex items-center gap-1">
                    {excerpt.type === "gif" ? (
                      <><Image size={12} className="shrink-0" /> GIF</>
                    ) : excerpt.type === "file" ? (
                      <><Paperclip size={12} className="shrink-0" /> Fichier</>
                    ) : (
                      excerpt.text.length > 38
                        ? excerpt.text.slice(0, 38) + "…"
                        : excerpt.text
                    )}
                  </span>
                  {unread > 0 && (
                    <span className="min-w-4.5 h-4.5 rounded-full bg-[#0066CC] text-white text-[10px] font-mono font-semibold flex items-center justify-center px-1 shrink-0">
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-3 border-t border-[#D5DAE0]">
        <button className="w-full h-10 rounded flex items-center justify-center gap-2 border border-[#D5DAE0] bg-white text-[#333333] text-[13px] font-medium hover:bg-[#F5F7FA] transition-colors">
          <UserPlus size={16} className="text-[#0066CC]" />
          Nouveau message
        </button>
      </div>
    </aside>
  );
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}
