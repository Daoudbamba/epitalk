"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { usePresenceStore } from "@/store/presence.store";
import { useDmStore } from "@/store/dm.store";
import type { PresenceStatus } from "@/lib/ws/types";
import { serversApi } from "@/lib/api";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";

const ROLE_OPTIONS = ["Admin", "Moderator", "Member"] as const;
const ROLE_LABELS: Record<string, string> = {
  Owner: "Propriétaire",
  Admin: "Admin",
  Moderator: "Modérateur",
  Member: "Membre",
};
const ROLE_BADGE: Record<string, string> = {
  Owner: "CRÉATEUR",
  Admin: "ADMIN",
  Moderator: "MODÉRATEUR",
  Member: "MEMBRE",
};

type BanDurationUnit = "minutes" | "hours" | "days";

function computeExpiresAt(value: number, unit: BanDurationUnit): string {
  const msMap: Record<BanDurationUnit, number> = {
    minutes: value * 60 * 1000,
    hours: value * 60 * 60 * 1000,
    days: value * 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + msMap[unit]).toISOString();
}

function formatExpiry(expiresAt: string | null | undefined, isEnglish: boolean): string {
  if (!expiresAt || expiresAt === "null") return isEnglish ? "Permanent" : "Permanent";
  const ts = new Date(expiresAt).getTime();
  if (isNaN(ts)) return isEnglish ? "Permanent" : "Permanent";
  const diff = ts - Date.now();
  if (diff <= 0) return isEnglish ? "Expired" : "Expiré";
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) {
    return isEnglish
      ? `Expires in ${minutes}m`
      : `Expire dans ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return isEnglish
      ? `Expires in ${hours}h`
      : `Expire dans ${hours} heure${hours > 1 ? "s" : ""}`;
  }
  const days = Math.floor(hours / 24);
  return isEnglish
    ? `Expires in ${days}d`
    : `Expire dans ${days} jour${days > 1 ? "s" : ""}`;
}

function MemberMenu({
  showKick,
  showBan,
  onKick,
  onBanPermanent,
  onBanTemporary,
  isEnglish,
}: {
  showKick: boolean;
  showBan: boolean;
  onKick: () => void;
  onBanPermanent: () => void;
  onBanTemporary: () => void;
  isEnglish: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="h-6 w-6 p-0 text-base leading-none text-muted-foreground"
        title={isEnglish ? "Actions" : "Actions"}
      >
        ···
      </Button>
      {open && (
        <div className="absolute right-0 top-7 z-50 min-w-37 rounded-lg border border-border bg-card shadow-lg py-1">
          {showKick && (
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted text-orange-600"
              onClick={() => { setOpen(false); onKick(); }}
            >
              {isEnglish ? "Kick" : "Expulser"}
            </button>
          )}
          {showBan && (
            <>
              {showKick && <div className="my-1 border-t border-border" />}
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted text-red-600"
                onClick={() => { setOpen(false); onBanPermanent(); }}
              >
                {isEnglish ? "Permanent ban" : "Ban définitif"}
              </button>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted text-red-500"
                onClick={() => { setOpen(false); onBanTemporary(); }}
              >
                {isEnglish ? "Temporary ban" : "Ban temporaire"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
  const presence = usePresenceStore((s) => s.presence);
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

  // Kick modal state
  const [kickTarget, setKickTarget] = useState<{ id: string; username: string } | null>(null);

  // Ban modal state
  const [banTarget, setBanTarget] = useState<{ id: string; username: string; permanent: boolean } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDurationValue, setBanDurationValue] = useState<number>(1);
  const [banDurationUnit, setBanDurationUnit] = useState<BanDurationUnit>("hours");

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
        const { setUserPresence } = usePresenceStore.getState();
        for (const member of data) {
          setUserPresence(
            member.user_id,
            (member.status?.toLowerCase() ?? "offline") as PresenceStatus,
          );
        }
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

  const doKick = async () => {
    if (!server || !kickTarget) return;
    const { id: targetId } = kickTarget;
    setKickTarget(null);
    setLoadingKick(targetId);
    setActionError(null);
    // Optimistic: remove from list immediately
    setMembers(members.filter((m) => m.user_id !== targetId));
    try {
      await serversApi.kickMember(server.id, targetId);
      const data = await serversApi.listMembers(server.id);
      setMembers(data);
      await onRefresh();
    } catch (err) {
      console.error("Kick error:", err);
      setActionError(getErrorMessage(err));
      try {
        const data = await serversApi.listMembers(server.id);
        setMembers(data);
      } catch {
        // leave optimistic state
      }
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

  const doBan = async () => {
    if (!server || !banTarget) return;
    const { id: memberId, permanent } = banTarget;
    const expiresAt = permanent ? null : computeExpiresAt(banDurationValue, banDurationUnit);
    const reason = banReason.trim() || null;
    setBanTarget(null);
    setBanReason("");
    setBanDurationValue(1);
    setBanDurationUnit("hours");
    setLoadingBan(memberId);
    setActionError(null);
    // Optimistic: remove from list immediately
    setMembers(members.filter((m) => m.user_id !== memberId));
    try {
      await serversApi.banMember(server.id, memberId, {
        reason,
        expires_at: expiresAt,
      });
      const [membersData, bansData] = await Promise.all([
        serversApi.listMembers(server.id),
        serversApi.listBans(server.id),
      ]);
      setMembers(membersData);
      setBans(bansData);
      try {
        await onRefresh();
      } catch (refreshError) {
        console.warn("Servers refresh after ban failed:", refreshError);
      }
    } catch (err) {
      console.error("Ban error:", err);
      setActionError(getErrorMessage(err));
      try {
        const data = await serversApi.listMembers(server.id);
        setMembers(data);
      } catch {
        // leave optimistic state
      }
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
      <aside className="h-full flex flex-col bg-[#F5F5F5] border-l border-[#D5DAE0] p-3 overflow-auto">
        <h3 className="text-[14px] font-semibold text-[#003D82] mb-3">
          {isEnglish ? "Members" : "Membres"}
        </h3>
        <p className="text-xs text-[#8A929C]">
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
      presence[a.user_id]?.status?.toLowerCase() === "online" ? 0 : 1;
    const bOnline =
      presence[b.user_id]?.status?.toLowerCase() === "online" ? 0 : 1;
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
    (m) => presence[m.user_id]?.status?.toLowerCase() === "online",
  ).length;

  return (
    <aside className="h-full w-full flex flex-col bg-[#F5F5F5] border-l border-[#D5DAE0] overflow-hidden">
      {/* Kick confirmation modal */}
      <ConfirmActionDialog
        open={!!kickTarget}
        onOpenChange={(open) => { if (!open) setKickTarget(null); }}
        title={
          isEnglish
            ? `Kick ${kickTarget?.username ?? ""}?`
            : `Expulser ${kickTarget?.username ?? ""} ?`
        }
        description={
          isEnglish
            ? "This member will be removed from the server but can rejoin with an invite."
            : "Ce membre sera retiré du serveur mais pourra rejoindre avec une invitation."
        }
        confirmLabel={isEnglish ? "Kick" : "Expulser"}
        cancelLabel={isEnglish ? "Cancel" : "Annuler"}
        confirmVariant="destructive"
        loading={loadingKick !== null}
        onConfirm={doKick}
      />

      {/* Ban modal */}
      <Dialog
        open={!!banTarget}
        onOpenChange={(open) => {
          if (!open) {
            setBanTarget(null);
            setBanReason("");
            setBanDurationValue(1);
            setBanDurationUnit("hours");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {banTarget?.permanent
                ? (isEnglish
                    ? `Ban ${banTarget.username} permanently?`
                    : `Bannir définitivement ${banTarget.username} ?`)
                : (isEnglish
                    ? `Temporarily ban ${banTarget?.username ?? ""}?`
                    : `Bannir temporairement ${banTarget?.username ?? ""} ?`)}
            </DialogTitle>
            <DialogDescription>
              {isEnglish
                ? "The member will be removed and prevented from rejoining."
                : "Le membre sera retiré et empêché de rejoindre le serveur."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-foreground">
                {isEnglish ? "Reason (optional)" : "Motif (optionnel)"}
              </label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder={isEnglish ? "Enter a reason…" : "Entrez un motif…"}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {!banTarget?.permanent && (
              <div>
                <label className="text-xs font-medium text-foreground">
                  {isEnglish ? "Duration" : "Durée"}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    min={1}
                    value={banDurationValue}
                    onChange={(e) =>
                      setBanDurationValue(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-24 rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <select
                    value={banDurationUnit}
                    onChange={(e) => setBanDurationUnit(e.target.value as BanDurationUnit)}
                    className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="minutes">{isEnglish ? "Minutes" : "Minutes"}</option>
                    <option value="hours">{isEnglish ? "Hours" : "Heures"}</option>
                    <option value="days">{isEnglish ? "Days" : "Jours"}</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBanTarget(null);
                setBanReason("");
                setBanDurationValue(1);
                setBanDurationUnit("hours");
              }}
              disabled={loadingBan !== null}
            >
              {isEnglish ? "Cancel" : "Annuler"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void doBan()}
              disabled={loadingBan !== null}
            >
              {loadingBan !== null ? "..." : (isEnglish ? "Ban" : "Bannir")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#D5DAE0] shrink-0">
        <span className="text-[#003D82] text-[14px] font-semibold">
          {language === "en" ? "Members" : "Membres"}
        </span>
        <span className="flex items-center gap-1 text-[13px] text-[#8A929C]">
          <span className="w-2 h-2 rounded-full bg-[#2BAE5C] inline-block" />
          {membersLoading ? "…" : onlineCount}
        </span>
      </div>

      {/* Personal status control */}
      {currentUser && (
        <div className="px-4 py-2 flex items-center gap-2 border-b border-[#D5DAE0] shrink-0">
          <label className="text-[11px] text-[#8A929C] shrink-0">Statut :</label>
          <select
            value={presence?.[currentUser.id]?.status ?? "online"}
            onChange={(e) =>
              setPresence?.(
                e.target.value as "online" | "idle" | "dnd" | "offline",
              )
            }
            className="flex-1 text-[11px] border border-[#D5DAE0] rounded px-2 py-1 bg-white text-[#6B737D] focus:outline-none"
          >
            <option value="online">En ligne</option>
            <option value="idle">Inactif</option>
            <option value="dnd">Ne pas déranger</option>
          </select>
        </div>
      )}

      {actionError && (
        <div className="mx-3 mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="shrink-0">⚠</span>
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 ml-1">×</button>
        </div>
      )}

      {membersLoading ? (
        <p className="text-sm text-[#8A929C] px-4 py-3">
          {language === "en" ? "Loading..." : "Chargement..."}
        </p>
      ) : (
        <ul className="flex-1 overflow-auto py-2 space-y-0.5">
          {sortedMembers.map((m) => {
            const memberIsOwner = m.role === "Owner";
            const isSelf = currentUser?.id === m.user_id;
            const showKick = isOwner && !memberIsOwner && !isSelf;
            const showBan = canBan && !memberIsOwner && !isSelf;

            const presenceStatus = presence[m.user_id]?.status?.toLowerCase();
            const isOnline = presenceStatus === "online";
            const isDnd = presenceStatus === "dnd";

            return (
              <li key={m.user_id} className="flex flex-col gap-1 mx-2">
                <div className="h-8 flex items-center gap-3 px-2 rounded hover:bg-[#ECEEF1] cursor-pointer group/member transition-colors">
                  {/* Avatar with presence dot */}
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-full bg-[#E6F0FB] flex items-center justify-center text-[11px] font-semibold font-mono text-[#003D82] overflow-hidden">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}${m.avatar_url}`}
                          alt={m.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (m.username || "U").slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#F5F5F5] ${
                        isOnline ? "bg-[#2BAE5C]" : isDnd ? "bg-[#D93F3F]" : "bg-[#8A929C]"
                      }`}
                      title={presence[m.user_id]?.status ?? "offline"}
                    />
                  </div>

                  {/* Name + role */}
                  <span className={`flex-1 text-[13px] truncate ${isOnline || isDnd ? "text-[#333333]" : "text-[#8A929C]"}`}>
                    {m.username || "Utilisateur"}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-[#8A929C] whitespace-nowrap">
                    {ROLE_BADGE[m.role] ?? m.role.toUpperCase()}
                  </span>

                  {/* Action icons — visible on hover */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/member:opacity-100 transition-opacity shrink-0">
                    {currentUser && m.user_id !== currentUser.id && (
                      <button
                        onClick={() => { setActivePeer(m.user_id); router.push("/dm"); }}
                        title="Message privé"
                        className="w-6 h-6 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#D5DAE0] hover:text-[#333333] transition-colors"
                      >
                        <i className="bi bi-chat-dots text-[12px]" />
                      </button>
                    )}
                    {(showKick || showBan) && (
                      <MemberMenu
                        showKick={showKick}
                        showBan={showBan}
                        onKick={() => setKickTarget({ id: m.user_id, username: m.username })}
                        onBanPermanent={() => { setBanTarget({ id: m.user_id, username: m.username, permanent: true }); setBanReason(""); }}
                        onBanTemporary={() => { setBanTarget({ id: m.user_id, username: m.username, permanent: false }); setBanReason(""); setBanDurationValue(1); setBanDurationUnit("hours"); }}
                        isEnglish={isEnglish}
                      />
                    )}
                  </div>
                </div>

                {isOwner && !memberIsOwner && (
                  <select
                    value={m.role}
                    onChange={(e) => onChangeRole(m.user_id, e.target.value)}
                    disabled={loadingRole === m.user_id}
                    className="text-[11px] border border-[#D5DAE0] rounded px-1 py-0.5 bg-white text-[#6B737D] ml-10"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Active bans section */}
      <div className="border-t border-[#D5DAE0] pt-3 px-4 pb-3 shrink-0">
        <h4 className="text-[11px] font-mono font-semibold uppercase tracking-[0.06em] text-[#8A929C] mb-2">
          {isEnglish ? "Active bans" : "Bans actifs"}
        </h4>
        {loadingBans ? (
          <p className="text-xs text-[#8A929C]">
            {isEnglish ? "Loading..." : "Chargement..."}
          </p>
        ) : bans.length === 0 ? (
          <p className="text-xs text-[#8A929C]">
            {isEnglish ? "No active bans." : "Aucun ban actif."}
          </p>
        ) : (
          <div className="space-y-2">
            {bans.map((ban) => (
              <div
                key={ban.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#D5DAE0] p-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{ban.username}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {ban.reason || (isEnglish ? "No reason" : "Sans motif")}
                  </div>
                  <div className={`text-[10px] font-medium ${!ban.expires_at ? "text-red-500" : "text-muted-foreground"}`}>
                    {formatExpiry(ban.expires_at, isEnglish)}
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
                        : "Débannir"}
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
