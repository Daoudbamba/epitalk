"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { serversApi } from "@/lib/api";

const ROLE_OPTIONS = ["Admin", "Moderator", "Member"] as const;
const ROLE_LABELS: Record<string, string> = {
  Owner: "👑 Propriétaire",
  Admin: "🛡️ Admin",
  Moderator: "🔧 Modérateur",
  Member: "👤 Membre",
};

export function MembersPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const currentUser = useAuthStore((s) => s.user);
  const members = useMemberStore((s) => s.members);
  const setMembers = useMemberStore((s) => s.setMembers);
  const membersLoading = useMemberStore((s) => s.loading);
  const setMembersLoading = useMemberStore((s) => s.setLoading);
  const onlineUsers = useWebSocketStore((s) => s.onlineUsers);

  const server = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const isMemberOfActiveServer = !!server;
  const [loadingKick, setLoadingKick] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  useEffect(() => {
    if (!activeServerId || !isMemberOfActiveServer) {
      setMembers([]);
      return;
    }
    const loadMembers = async () => {
      setMembersLoading(true);
      try {
        const data = await serversApi.listMembers(activeServerId);
        setMembers(data);
      } catch (err) {
        console.error("Failed to load members:", err);
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    };
    loadMembers();
  }, [activeServerId, isMemberOfActiveServer, setMembers, setMembersLoading]);

  const onKick = async (memberId: string) => {
    if (!server) return;
    const ok = confirm("Expulser ce membre ?");
    if (!ok) return;
    setLoadingKick(memberId);
    try {
      await serversApi.kickMember(server.id, memberId);
      const data = await serversApi.listMembers(server.id);
      setMembers(data);
      await onRefresh();
    } catch (err) {
      console.error("Kick error:", err);
      alert("Erreur lors de l'expulsion");
    } finally {
      setLoadingKick(null);
    }
  };

  const onChangeRole = async (memberId: string, newRole: string) => {
    if (!server) return;
    setLoadingRole(memberId);
    try {
      await serversApi.updateMemberRole(server.id, memberId, newRole);
      const data = await serversApi.listMembers(server.id);
      setMembers(data);
    } catch (err) {
      console.error("Role update error:", err);
      alert("Erreur lors du changement de rôle");
    } finally {
      setLoadingRole(null);
    }
  };

  if (!server) {
    return (
      <aside className="w-64 border-l p-4">
        <h3 className="text-sm font-semibold mb-4">Membres</h3>
        <p className="text-sm text-muted-foreground">Aucun serveur sélectionné</p>
      </aside>
    );
  }

  const isOwner = !!currentUser && server.owner_id === currentUser.id;

  // Sort: online first, then by role priority
  const sortedMembers = [...members].sort((a, b) => {
    const aOnline = onlineUsers.includes(a.user_id) ? 0 : 1;
    const bOnline = onlineUsers.includes(b.user_id) ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    const rolePriority: Record<string, number> = { Owner: 0, Admin: 1, Moderator: 2, Member: 3 };
    return (rolePriority[a.role] ?? 4) - (rolePriority[b.role] ?? 4);
  });

  const onlineCount = members.filter((m) => onlineUsers.includes(m.user_id)).length;

  return (
    <aside className="h-[95%] rounded-md my-5 mb-30 border-2 border-gray-200 w-64 border-l p-4 overflow-auto">
      <h3 className="text-sm font-semibold mb-1">
        Membres ({membersLoading ? "..." : members.length})
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
        {onlineCount} en ligne
      </p>

      {membersLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {sortedMembers.map((m) => {
            const memberIsOwner = m.role === "Owner";
            const isOnline = onlineUsers.includes(m.user_id);

            return (
              <li key={m.user_id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {/* Avatar with online indicator */}
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-100">
                      {(m.username || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        isOnline ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isOnline ? "text-zinc-800" : "text-zinc-400"}`}>
                      {m.username || "Utilisateur"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {ROLE_LABELS[m.role] || m.role}
                    </div>
                  </div>

                  {isOwner && !memberIsOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onKick(m.user_id)}
                      disabled={loadingKick === m.user_id}
                      title="Expulser"
                      className="h-6 w-6 p-0 text-xs"
                    >
                      {loadingKick === m.user_id ? "..." : "×"}
                    </Button>
                  )}
                </div>

                {/* Role management dropdown (owner only, not for other owners) */}
                {isOwner && !memberIsOwner && (
                  <select
                    value={m.role}
                    onChange={(e) => onChangeRole(m.user_id, e.target.value)}
                    disabled={loadingRole === m.user_id}
                    className="text-xs border rounded px-1 py-0.5 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role] || role}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
