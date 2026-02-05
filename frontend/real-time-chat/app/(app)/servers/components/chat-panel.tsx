"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Smile, Send, Loader2 } from "lucide-react";
import { useServerStore } from "@/store/server.store";
import { useChannelStore } from "@/store/channel.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { messagesApi } from "@/lib/api";

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
  const setMessages = useWebSocketStore((s) => s.setMessages);

  const activeChannelName = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId)?.name ?? null;
  }, [channels, activeChannelId]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  // Load message history and join channel when it changes
  useEffect(() => {
    const loadHistory = async () => {
      if (!activeServerId || !activeChannelId) return;
      
      setLoadingHistory(true);
      try {
        const history = await messagesApi.list(activeServerId, activeChannelId);
        // Convert API messages to WsMessage format
        const wsFormattedMessages = history.map((msg) => ({
          id: msg.id,
          channel_id: msg.channel_id,
          author_id: msg.author_id,
          content: msg.content,
          created_at: msg.created_at,
        }));
        setMessages(activeChannelId, wsFormattedMessages);
      } catch (e) {
        console.error("Failed to load message history:", e);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();

    // Also join channel via WebSocket for real-time updates
    if (activeChannelId && isConnected) {
      joinChannel(activeChannelId);
    }
  }, [activeServerId, activeChannelId, isConnected, joinChannel, setMessages]);

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
    <div className="h-[95%] rounded-2xl my-4 mx-2 flex-1 min-w-0 flex flex-col bg-white/80 backdrop-blur-sm border border-[#E5E7EB] shadow-lg overflow-hidden relative">
      
      {/* Wave pattern background */}
      <div className="absolute inset-0 wave-pattern opacity-30 pointer-events-none" />
      
      {/* --- HEADER --- */}
      <div className="h-16 px-6 flex items-center border-b border-[#E5E7EB]/50 bg-gradient-to-r from-white to-[#F7F8FA] relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#023BFC]/10 to-[#023BFC]/5 flex items-center justify-center">
            <span className="text-[#023BFC] text-lg font-bold">#</span>
          </div>
          <div>
            <h2 className="font-bold text-[#1A1A2E]">
              {activeChannelName ?? "aucun-channel"}
            </h2>
            <p className="text-xs text-[#6B7280]">
              {isConnected ? "Connecté" : "Déconnecté"} • {messages.length} message{messages.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        
        {/* Connection indicator */}
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          <span className="text-xs text-[#6B7280]">{isConnected ? "En ligne" : "Hors ligne"}</span>
        </div>
      </div>

      {/* --- MESSAGES --- */}
      <div className="flex-1 overflow-y-auto flex flex-col py-4 relative z-10 scrollbar-thin">
        {!canLoad ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#EBF0FF] to-[#F7F8FA] flex items-center justify-center mb-6 shadow-lg">
              <svg className="w-10 h-10 text-[#023BFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-[#1A1A2E] font-semibold">Bienvenue !</p>
            <p className="text-sm text-[#6B7280] mt-2">Sélectionne un serveur et un channel pour commencer à discuter.</p>
          </div>
        ) : loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full border-3 border-[#023BFC] border-t-transparent animate-spin mb-4" />
            <p className="text-[#6B7280]">Chargement des messages...</p>
          </div>
        ) : !isConnected ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-full border-3 border-[#023BFC] border-t-transparent animate-spin mb-4" />
            <p className="text-[#6B7280]">Connexion au serveur...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#EBF0FF] to-white flex items-center justify-center mb-6 shadow-lg">
              <svg className="w-10 h-10 text-[#023BFC]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="text-[#1A1A2E] font-semibold">Aucun message</p>
            <p className="text-sm text-[#6B7280] mt-2">Soyez le premier à écrire dans #{activeChannelName} !</p>
          </div>
        ) : (
          <div className="flex flex-col mt-auto px-4">
            {messages.map((msg: { id: string; channel_id: string; author_id: string; content: string; created_at: string }, index: number) => {
              const isOwn = user && user.id === msg.author_id;
              const showAvatar = index === 0 || messages[index - 1]?.author_id !== msg.author_id;
              
              return (
                <div
                  key={msg.id}
                  className={`group flex items-start py-2 px-4 hover:bg-[#023BFC]/5 rounded-2xl transition-all duration-200 ${!showAvatar ? "pt-1" : "mt-3"}`}
                >
                  {showAvatar ? (
                    <div className="mr-4 shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-md ${
                        isOwn 
                          ? "bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] text-white" 
                          : "bg-gradient-to-br from-[#F7F8FA] to-[#E5E7EB] text-[#1A1A2E]"
                      }`}>
                        {getUsernameById(msg.author_id).slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 mr-4 shrink-0" />
                  )}

                  <div className="flex flex-col flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-semibold text-sm ${isOwn ? "text-[#023BFC]" : "text-[#1A1A2E]"}`}>
                          {getUsernameById(msg.author_id)}
                        </span>
                        <span className="text-xs text-[#9CA3AF]">
                          {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-[#4B5563] whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>
        )}

        {error && (
          <div className="mx-4 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* --- INPUT - Glassmorphism floating bar --- */}
      <div className="p-4 relative z-10 shrink-0">
        <div className="input-floating relative flex items-center gap-3 p-2">
          {/* Attachment button */}
          <button
            type="button"
            className="w-10 h-10 rounded-xl bg-[#F7F8FA] hover:bg-[#EBF0FF] border border-[#E5E7EB] text-[#6B7280] hover:text-[#023BFC] flex items-center justify-center transition-all duration-300"
            disabled
            title="Joindre un fichier (bientôt disponible)"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Input field */}
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canLoad || sending || !isConnected}
            className="flex-1 h-12 px-5 rounded-xl bg-white/80 border border-[#E5E7EB] focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20 text-[#1A1A2E] placeholder:text-[#9CA3AF] transition-all duration-300"
            placeholder={
              !canLoad
                ? "Sélectionne un channel..."
                : !isConnected
                ? "Connexion en cours..."
                : `Écrire dans #${activeChannelName ?? ""}...`
            }
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-10 h-10 rounded-xl hover:bg-[#F7F8FA] text-[#9CA3AF] hover:text-[#6B7280] flex items-center justify-center transition-all duration-300"
              disabled
              title="Emoji (bientôt disponible)"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Send button */}
            <Button
              onClick={onSend}
              disabled={!canLoad || sending || !isConnected || !value.trim()}
              className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] hover:from-[#0230D0] hover:to-[#023BFC] text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
              title="Envoyer"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Connection status */}
        {!isConnected && canLoad && (
          <div className="mt-3 text-xs text-amber-600 flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reconnexion en cours...
          </div>
        )}
      </div>
    </div>
  );
}
