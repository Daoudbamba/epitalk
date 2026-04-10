"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { useDmStore } from "@/store/dm.store";
import { serversApi } from "@/lib/api";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";

const ROLE_OPTIONS = ["Admin", "Moderator", "Member"] as const;
const ROLE_LABELS: Record<string, string> = {
  Owner: "👑 Propriétaire",
  Admin: "🛡️ Admin",
  Moderator: "🔧 Modérateur",
  Member: "👤 Membre",
};

export function MembersPanel({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const currentUser = useAuthStore((s) => s.user);
  const members = useMemberStore((s) => s.members);
  const setMembers = useMemberStore((s) => s.setMembers);
  const membersLoading = useMemberStore((s) => s.loading);
  const setMembersLoading = useMemberStore((s) => s.setLoading);
  const presence = useWebSocketStore((s) => s.presence);
  const setPresence = useWebSocketStore((s) => s.setPresence);
  const setActivePeer = useDmStore((s) => s.setActivePeer);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const server = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId],
  );

  const isMemberOfActiveServer = !!server;
  const [loadingKick, setLoadingKick] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [loadingBan, setLoadingBan] = useState<string | null>(null);
  const [loadingUnban, setLoadingUnban] = useState<string | null>(null);
  const [bans, setBans] = useState<
    {
      id: string;
      user_id: string;
      username: string;
      banned_by: string;
      reason: string | null;
      expires_at: string | null;
      created_at: string;
    }[]
  >([]);
  const [loadingBans, setLoadingBans] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeServerId || !isMemberOfActiveServer) {
      setMembers([]);
      setBans([]);
      return;
    }
    const loadMembers = async () => {
      setMembersLoading(true);
      try {
        const data = await serversApi.listMembers(activeServerId);
        setMembers(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setMembers([]);
          return;
        }
        console.error("Failed to load members:", err);
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    };
    loadMembers();

    const loadBans = async () => {
      setLoadingBans(true);
      try {
        const data = await serversApi.listBans(activeServerId);
        setBans(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setBans([]);
          return;
        }
        console.error("Failed to load bans:", err);
        setBans([]);
      } finally {
        setLoadingBans(false);
      }
    };
    loadBans();
  }, [activeServerId, isMemberOfActiveServer, setMembers, setMembersLoading]);

  const onKick = async (memberId: string) => {
    if (!server) return;
    const ok = confirm("Expulser ce membre ?");
    if (!ok) return;
    setLoadingKick(memberId);
    setActionError(null);
    try {
      await serversApi.kickMember(server.id, memberId);
      const data = await serversApi.listMembers(server.id);
      setMembers(data);
      await onRefresh();
    } catch (err) {
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
      const data = await serversApi.listMembers(server.id);
      setMembers(data);
    } catch (err) {
      console.error("Role update error:", err);
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingRole(null);
    }
  };

  const onBan = async (memberId: string, isTemporary: boolean) => {
    if (!server) return;
    const reason = prompt(
      isEnglish
        ? "Reason for ban (optional)"
        : "Motif du ban (optionnel)",
      "",
    );

    let expiresAt: string | null = null;
    if (isTemporary) {
      const hoursRaw = prompt(
        isEnglish
          ? "Temporary ban duration in hours"
          : "Duree du ban temporaire en heures",
        "24",
      );
      const hours = Number(hoursRaw);
      if (!Number.isFinite(hours) || hours <= 0) {
        setActionError(
          isEnglish
            ? "Invalid duration"
            : "Duree invalide",
        );
        return;
      }
      const expires = new Date();
      expires.setHours(expires.getHours() + hours);
      expiresAt = expires.toISOString();
    }

    setLoadingBan(memberId);
    setActionError(null);

    try {
      await serversApi.banMember(server.id, memberId, {
        reason: reason?.trim() ? reason.trim() : null,
        expires_at: expiresAt,
      });
      const [membersData, bansData] = await Promise.all([
        serversApi.listMembers(server.id),
        serversApi.listBans(server.id),
      ]);
      setMembers(membersData);
      setBans(bansData);
      // Best effort: ban succeeded even if global servers refresh is temporarily slow.
      try {
        await onRefresh();
      } catch (refreshError) {
        console.warn("Servers refresh after ban failed:", refreshError);
      }
    } catch (err) {
      console.error("Ban error:", err);
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingBan(null);
    }
  };

  const onUnban = async (memberId: string) => {
    if (!server) return;
    setLoadingUnban(memberId);
    setActionError(null);
    try {
      await serversApi.unbanMember(server.id, memberId);
      const bansData = await serversApi.listBans(server.id);
      setBans(bansData);
    } catch (err) {
      console.error("Unban error:", err);
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingUnban(null);
    }
  };

  if (!server) {
    return (
      <aside className="w-full border-l p-4">
        <h3 className="text-sm font-semibold mb-4">
          {isEnglish ? "Members" : "Membres"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isEnglish ? "No server selected" : "Aucun serveur sélectionné"}
        </p>
      </aside>
    );
  }

  const isOwner = !!currentUser && server.owner_id === currentUser.id;
  const canBan = isOwner || members.find((m) => m.user_id === currentUser?.id)?.role === "Admin";

  // Sort: online first, then by role priority
  const sortedMembers = [...members].sort((a, b) => {
    const aOnline =
      presence && presence[a.user_id]?.status === "online" ? 0 : 1;
    const bOnline =
      presence && presence[b.user_id]?.status === "online" ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    const rolePriority: Record<string, number> = {
      Owner: 0,
      Admin: 1,
      Moderator: 2,
      Member: 3,
    };
    return (rolePriority[a.role] ?? 4) - (rolePriority[b.role] ?? 4);
  });

  const onlineCount = members.filter(
    (m) => presence && presence[m.user_id]?.status === "online",
  ).length;

  return (
    <aside className="h-[95%] rounded-2xl my-4 ml-2 border border-[var(--border)] w-full p-4 overflow-auto shadow-lg">
      <h3 className="text-sm font-semibold mb-1">
        {language === "en" ? "Members" : "Membres"} ({
          membersLoading ? "..." : members.length
        })
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
        {onlineCount} {language === "en" ? "online" : "en ligne"}
      </p>

      {/* Contrôle du statut personnel */}
      {currentUser && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <label className="text-xs text-muted-foreground">Mon statut:</label>
          <select
            value={presence?.[currentUser.id]?.status ?? "online"}
            onChange={(e) =>
              setPresence?.(
                e.target.value as "online" | "idle" | "dnd" | "offline",
              )
            }
            className="text-xs border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
          >
            <option value="online">En ligne</option>
            <option value="idle">Inactif</option>
            <option value="dnd">Ne pas déranger</option>
          </select>
        </div>
      )}

      {actionError && (
        <div className="mb-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="shrink-0">&#9888;</span>
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-600 ml-1"
          >
            &times;
          </button>
        </div>
      )}

      {membersLoading ? (
        <p className="text-sm text-muted-foreground">
          {language === "en" ? "Loading..." : "Chargement..."}
        </p>
      ) : (
        <ul className="space-y-3 text-sm">
          {sortedMembers.map((m) => {
            const memberIsOwner = m.role === "Owner";

            return (
              <li key={m.user_id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {/* Avatar with online indicator */}
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center text-xs font-semibold text-[var(--foreground)]">
                      {(m.username || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        presence && presence[m.user_id]
                          ? presence[m.user_id].status === "online"
                            ? "bg-green-500"
                            : presence[m.user_id].status === "idle"
                              ? "bg-red-500"
                              : presence[m.user_id].status === "dnd"
                                ? "bg-amber-500"
                                : "bg-gray-400"
                          : "bg-gray-400"
                      }`}
                      title={presence?.[m.user_id]?.status ?? "offline"}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-medium truncate ${presence && presence[m.user_id]?.status === "online" ? "text-zinc-800" : "text-zinc-400"}`}
                    >
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

                  {canBan && !memberIsOwner && currentUser?.id !== m.user_id && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onBan(m.user_id, false)}
                        disabled={loadingBan === m.user_id}
                        title={isEnglish ? "Ban" : "Bannir"}
                        className="h-6 px-2 text-[10px]"
                      >
                        {loadingBan === m.user_id ? "..." : isEnglish ? "Ban" : "Ban"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onBan(m.user_id, true)}
                        disabled={loadingBan === m.user_id}
                        title={isEnglish ? "Temporary ban" : "Ban temporaire"}
                        className="h-6 px-2 text-[10px]"
                      >
                        {loadingBan === m.user_id ? "..." : isEnglish ? "Temp" : "Temp"}
                      </Button>
                    </div>
                  )}

                  {/* DM button — don't show for yourself */}
                  {currentUser && m.user_id !== currentUser.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setActivePeer(m.user_id);
                        router.push("/dm");
                      }}
                      title="Message privé"
                      className="h-6 w-6 p-0 text-xs text-[var(--muted-foreground)] hover:text-[#023BFC]"
                    >
                      💬
                    </Button>
                  )}
                </div>

                {/* Role management dropdown (owner only, not for other owners) */}
                {isOwner && !memberIsOwner && (
                  <select
                    value={m.role}
                    onChange={(e) => onChangeRole(m.user_id, e.target.value)}
                    disabled={loadingRole === m.user_id}
                    className="text-xs border rounded px-1 py-0.5 bg-[var(--card)] text-[var(--muted-foreground)]"
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

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <h4 className="text-xs font-semibold mb-2">
          {isEnglish ? "Active bans" : "Bans actifs"}
        </h4>
        {loadingBans ? (
          <p className="text-xs text-muted-foreground">
            {isEnglish ? "Loading..." : "Chargement..."}
          </p>
        ) : bans.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {isEnglish ? "No active bans." : "Aucun ban actif."}
          </p>
        ) : (
          <div className="space-y-2">
            {bans.map((ban) => (
              <div
                key={ban.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{ban.username}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {ban.reason || (isEnglish ? "No reason" : "Sans motif")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {ban.expires_at
                      ? `${isEnglish ? "Expires" : "Expire"}: ${new Date(ban.expires_at).toLocaleString()}`
                      : isEnglish
                        ? "Permanent"
                        : "Permanent"}
                  </div>
                </div>
                {canBan && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onUnban(ban.user_id)}
                    disabled={loadingUnban === ban.user_id}
                    className="h-6 px-2 text-[10px]"
                  >
                    {loadingUnban === ban.user_id
                      ? "..."
                      : isEnglish
                        ? "Unban"
                        : "Debannir"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
