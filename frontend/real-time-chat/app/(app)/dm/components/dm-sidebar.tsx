"use client";

import { useEffect } from "react";
import { useDmStore } from "@/store/dm.store";
import { useAuthStore } from "@/store/auth.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { MessageSquare } from "lucide-react";

export function DmSidebar() {
  const conversations = useDmStore((s) => s.conversations);
  const activePeerId = useDmStore((s) => s.activePeerId);
  const setActivePeer = useDmStore((s) => s.setActivePeer);
  const fetchConversations = useDmStore((s) => s.fetchConversations);
  const loading = useDmStore((s) => s.loading);

  const user = useAuthStore((s) => s.user);
  const onlineUsers = useWebSocketStore((s) => s.onlineUsers);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <aside className="h-full flex flex-col bg-white/90 dark:bg-[#2b2d31] border-r border-[#E5E7EB]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-[#E5E7EB] shrink-0">
        <MessageSquare className="w-5 h-5 text-[#023BFC] mr-2" />
        <h2 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
          Messages privés
        </h2>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && conversations.length === 0 && (
          <div className="px-4 py-8 text-sm text-zinc-400 text-center">
            Chargement...
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="px-4 py-8 text-sm text-zinc-400 text-center">
            Aucune conversation privée.
            <br />
            <span className="text-xs">
              Envoie un message à un membre depuis un serveur pour commencer.
            </span>
          </div>
        )}

        {conversations.map((conv) => {
          const active = conv.peer_id === activePeerId;
          const isOnline = onlineUsers.includes(conv.peer_id);

          return (
            <button
              key={conv.conversation_id}
              onClick={() => setActivePeer(conv.peer_id)}
              className={[
                "w-full px-3 py-2.5 flex items-center gap-3 transition-all duration-200",
                active
                  ? "bg-[#023BFC]/10 border-l-2 border-[#023BFC]"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800 border-l-2 border-transparent",
              ].join(" ")}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div className={[
                  "w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold",
                  active
                    ? "bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] text-white"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-100",
                ].join(" ")}>
                  {conv.peer_username.slice(0, 2).toUpperCase()}
                </div>
                {/* Online indicator */}
                {isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#2b2d31] rounded-full" />
                )}
              </div>

              <div className="flex-1 min-w-0 text-left">
                <div className={[
                  "text-sm font-semibold truncate",
                  active ? "text-[#023BFC]" : "text-zinc-800 dark:text-zinc-100",
                ].join(" ")}>
                  {conv.peer_username}
                </div>
                <div className="text-xs text-zinc-400 truncate max-w-[160px]">
                  {conv.last_message.length > 40
                    ? conv.last_message.slice(0, 40) + "..."
                    : conv.last_message}
                </div>
              </div>

              {/* Time */}
              {conv.last_message_at && (
                <div className="text-[10px] text-zinc-400 shrink-0">
                  {formatTime(conv.last_message_at)}
                </div>
              )}
            </button>
          );
        })}
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
