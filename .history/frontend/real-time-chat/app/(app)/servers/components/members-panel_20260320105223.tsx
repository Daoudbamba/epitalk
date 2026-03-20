"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { serversApi } from "@/lib/api";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import type { Ban } from "@/lib/api/schemas/servers.schema";

const ROLE_OPTIONS = ["Admin", "Moderator", "Member"] as const;
const ROLE_LABELS: Record<string, string> = {
  Owner: "👑 Propriétaire",
  Admin: "🛡️ Admin",
  Moderator: "🔧 Modérateur",
  Member: "👤 Membre",
};

export function MembersPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const router = useRouter();
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const currentUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const members = useMemberStore((s) => s.members);
  const setMembers = useMemberStore((s) => s.setMembers);
  const membersLoading = useMemberStore((s) => s.loading);
  const setMembersLoading = useMemberStore((s) => s.setLoading);
  const onlineUsers = useWebSocketStore((s) => s.onlineUsers);
  const disconnect = useWebSocketStore((s) => s.disconnect);

  const server = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const isMemberOfActiveServer = !!server;
  const [loadingKick, setLoadingKick] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [loadingBan, setLoadingBan] = useState<string | null>(null);
  const [loadingUnban, setLoadingUnban] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bans, setBans] = useState<Ban[]>([]);

  const handleUnauthorized = (err: unknown): boolean => {
    if (err instanceof ApiError && err.status === 401) {
      disconnect();
      logout();
      router.replace("/login");
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!activeServerId || !isMemberOfActiveServer) {
      setMembers([]);
      setBans([]);
      return;
    }
    const loadData = async () => {
      setMembersLoading(true);
      try {
        const membersData = await serversApi.listMembers(activeServerId);
        setMembers(membersData);
        try {
          const bansData = await serversApi.listBans(activeServerId);
          setBans(bansData);
        } catch (banErr) {
          if (handleUnauthorized(banErr)) return;
          console.error("Failed to load bans:", banErr);
          setActionError(getErrorMessage(banErr));
          setBans([]);
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error("Failed to load members:", err);
        setMembers([]);
        setBans([]);
      } finally {
        setMembersLoading(false);
      }
    };
    loadData();
  }, [activeServerId, isMemberOfActiveServer, setMembers, setMembersLoading]);

  const reloadMembersAndBans = async () => {
    if (!server) return;
    const [membersData, bansData] = await Promise.all([
      serversApi.listMembers(server.id),
      serversApi.listBans(server.id),
    ]);
    setMembers(membersData);
    setBans(bansData);
  };

  const onKick = async (memberId: string) => {
    if (!server) return;
    const ok = confirm("Expulser ce membre ?");
    if (!ok) return;
    setLoadingKick(memberId);
    setActionError(null);
    try {
      await serversApi.kickMember(server.id, memberId);
      await reloadMembersAndBans();
      await onRefresh();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Kick error:", err);
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingKick(null);
    }
  };

  const onChangeRole = async (memberId: string, newRole: string) => {
    if (!server) return;
    setLoadingRole(memberId);
    setActionError(null);
    try {
      await serversApi.updateMemberRole(server.id, memberId, newRole);
      await reloadMembersAndBans();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Role update error:", err);
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingRole(null);
    }
  };

  const onBan = async (memberId: string, username: string) => {
    if (!server) return;
    const ok = confirm(`Bannir ${username} ?`);
    if (!ok) return;

    const reasonInput = prompt("Raison du ban (optionnel)");
    const reason = reasonInput && reasonInput.trim().length > 0 ? reasonInput.trim() : null;

    setLoadingBan(memberId);
    setActionError(null);
    try {
      await serversApi.banMember(server.id, memberId, {
        reason,
        expires_at: null,
      });
      await reloadMembersAndBans();
      await onRefresh();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Ban error:", err);
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingBan(null);
    }
  };

  const onUnban = async (userId: string, username: string) => {
    if (!server) return;
    const ok = confirm(`Débannir ${username} ?`);
    if (!ok) return;

    setLoadingUnban(userId);
    setActionError(null);
    try {
      await serversApi.unbanMember(server.id, userId);
      await reloadMembersAndBans();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Unban error:", err);
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingUnban(null);
    }
  };

  if (!server) {
    return (
      <aside className="w-full border-l p-4">
        <h3 className="text-sm font-semibold mb-4">Membres</h3>
        <p className="text-sm text-muted-foreground">Aucun serveur sélectionné</p>
      </aside>
    );
  }

  const isOwner = !!currentUser && server.owner_id === currentUser.id;
  const currentUserRole = members.find((m) => m.user_id === currentUser?.id)?.role;
  const canBan = currentUserRole === "Owner" || currentUserRole === "Admin";

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
    <aside className="h-[95%] rounded-2xl my-4 ml-2 border border-[#E5E7EB] w-full p-4 overflow-auto shadow-lg">
      <h3 className="text-sm font-semibold mb-1">
        Membres ({membersLoading ? "..." : members.length})
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
        {onlineCount} en ligne
      </p>

      {actionError && (
        <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="shrink-0">&#9888;</span>
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 ml-1">&times;</button>
        </div>
      )}

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

                  <div className="flex items-center gap-1">
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

                    {canBan && !memberIsOwner && m.user_id !== currentUser?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onBan(m.user_id, m.username || "Utilisateur")}
                        disabled={loadingBan === m.user_id}
                        title="Bannir"
                        className="h-6 px-2 text-[10px] border-red-300 text-red-600 hover:bg-red-50"
                      >
                        {loadingBan === m.user_id ? "..." : "Ban"}
                      </Button>
                    )}
                  </div>
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

      <div className="mt-6 pt-3 border-t">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
          Bannis actifs ({bans.length})
        </h4>
        {bans.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun bannissement actif.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {bans.map((ban) => (
              <li key={ban.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{ban.username}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {ban.reason ? `Raison: ${ban.reason}` : "Sans raison"}
                  </div>
                </div>
                {canBan && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onUnban(ban.user_id, ban.username)}
                    disabled={loadingUnban === ban.user_id}
                  >
                    {loadingUnban === ban.user_id ? "..." : "Unban"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
