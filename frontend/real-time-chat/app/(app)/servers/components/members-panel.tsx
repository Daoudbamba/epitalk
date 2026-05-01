"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
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

const ROLE_TAG: Record<string, string> = {
  Owner: "PED",
  Admin: "PED",
  Moderator: "APE",
  Member: "B1",
};
const ROLE_TAG_CLASS: Record<string, string> = {
  Owner: "text-[#003D82]",
  Admin: "text-[#003D82]",
  Moderator: "text-[#8A3F18]",
  Member: "text-[#6B737D]",
};
const ROLE_CATEGORY: Record<string, string> = {
  Owner: "PÉDAGO",
  Admin: "PÉDAGO",
  Moderator: "STAFF",
  Member: "ÉTUDIANTS",
};

const STATUS_CONFIG: Record<string, { label: string; labelFr: string; dot: string }> = {
  online:  { label: "Online",           labelFr: "En ligne",          dot: "bg-[#2BAE5C]" },
  dnd:     { label: "Do not disturb",   labelFr: "Ne pas déranger",   dot: "bg-[#D93F3F]" },
  offline: { label: "Offline",          labelFr: "Hors ligne",        dot: "bg-[#8A929C]" },
  idle:    { label: "Away",             labelFr: "Absent",            dot: "bg-[#8A929C]" },
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
  canChangeRole,
  showKick,
  showBan,
  onRolePedago,
  onRoleStaff,
  onRoleMember,
  onKick,
  onBanTemporary,
  onBanPermanent,
  isEnglish,
}: {
  canChangeRole: boolean;
  showKick: boolean;
  showBan: boolean;
  onRolePedago: () => void;
  onRoleStaff: () => void;
  onRoleMember: () => void;
  onKick: () => void;
  onBanTemporary: () => void;
  onBanPermanent: () => void;
  isEnglish: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-6 h-6 rounded text-[#8A929C] hover:bg-[#D5DAE0] hover:text-[#333333] flex items-center justify-center"
        title={isEnglish ? "Actions" : "Actions"}
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute top-8 right-0 z-50 bg-white rounded-lg shadow-lg border border-[#D5DAE0] min-w-50 py-1">
          {canChangeRole && (
            <>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#ECEEF1] text-[#333333]"
                onClick={() => { setOpen(false); onRolePedago(); }}
              >
                {isEnglish ? "Set as Pédago" : "Définir comme Pédago"}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#ECEEF1] text-[#333333]"
                onClick={() => { setOpen(false); onRoleStaff(); }}
              >
                {isEnglish ? "Set as Staff (APE)" : "Définir comme Staff (APE)"}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#ECEEF1] text-[#333333]"
                onClick={() => { setOpen(false); onRoleMember(); }}
              >
                {isEnglish ? "Set as Student" : "Définir comme Étudiant"}
              </button>
              <div className="h-px bg-[#E1E5EA] my-1" />
            </>
          )}
          {showKick && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#ECEEF1] text-[#D93F3F]"
              onClick={() => { setOpen(false); onKick(); }}
            >
              {isEnglish ? "Kick" : "Expulser"}
            </button>
          )}
          {showBan && (
            <>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#ECEEF1] text-[#D93F3F]"
                onClick={() => { setOpen(false); onBanTemporary(); }}
              >
                {isEnglish ? "Temporary ban" : "Bannir temporairement"}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#ECEEF1] text-[#D93F3F]"
                onClick={() => { setOpen(false); onBanPermanent(); }}
              >
                {isEnglish ? "Permanent ban" : "Bannir définitivement"}
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

  // Presence dropdown
  const [presenceOpen, setPresenceOpen] = useState(false);
  const presenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!presenceOpen) return;
    const handler = (e: MouseEvent) => {
      if (presenceRef.current && !presenceRef.current.contains(e.target as Node)) {
        setPresenceOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [presenceOpen]);

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

  const [kickTarget, setKickTarget] = useState<{ id: string; username: string } | null>(null);
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
      <aside className="flex flex-col w-60 min-h-full bg-[#F5F5F5] border-l border-[#D5DAE0] p-3 overflow-auto">
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
  const currentUserRole = members.find((m) => m.user_id === currentUser?.id)?.role;
  const isPedagoOrOwner = isOwner || currentUserRole === "Admin";
  const isModerator = currentUserRole === "Moderator";
  const canBan = isPedagoOrOwner;

  // Presence helpers
  const myRawStatus = presence[currentUser?.id ?? ""]?.status?.toLowerCase() ?? "online";
  const myStatusConfig = STATUS_CONFIG[myRawStatus] ?? STATUS_CONFIG.online;

  const sortedMembers = [...members].sort((a, b) => {
    const aOnline = presence[a.user_id]?.status?.toLowerCase() === "online" ? 0 : 1;
    const bOnline = presence[b.user_id]?.status?.toLowerCase() === "online" ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    const rolePriority: Record<string, number> = {
      Owner: 0,
      Admin: 1,
      Moderator: 2,
      Member: 3,
    };
    return (rolePriority[a.role] ?? 4) - (rolePriority[b.role] ?? 4);
  });

  const offlineCount = members.filter(
    (m) => (presence[m.user_id]?.status?.toLowerCase() ?? "offline") === "offline",
  ).length;

  const categoryOrder = ["PÉDAGO", "STAFF", "ÉTUDIANTS"];
  const grouped = categoryOrder
    .map((cat) => ({
      label: cat,
      members: sortedMembers.filter((m) => (ROLE_CATEGORY[m.role] ?? "ÉTUDIANTS") === cat),
    }))
    .filter((g) => g.members.length > 0);

  return (
    <aside className="flex flex-col w-60 min-h-full bg-[#F5F5F5] border-l border-[#D5DAE0] overflow-hidden">
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
      <div className="px-4 pt-3 pb-2 border-b border-[#D5DAE0] shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold text-[#003D82]">
            {isEnglish ? "Members" : "Membres"} · {members.length}
          </span>
        </div>

        {/* Presence selector */}
        {currentUser && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
              {isEnglish ? "My status" : "Mon statut"}
            </span>
            <div className="relative" ref={presenceRef}>
              <button
                onClick={() => setPresenceOpen((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] text-[#333333] hover:text-[#003D82] transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${myStatusConfig.dot}`} />
                <span>{isEnglish ? myStatusConfig.label : myStatusConfig.labelFr}</span>
              </button>
              {presenceOpen && (
                <div className="absolute top-6 right-0 z-50 bg-white rounded-lg shadow-lg border border-[#D5DAE0] min-w-45 py-1">
                  {(["online", "dnd", "offline"] as const).map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    return (
                      <button
                        key={status}
                        type="button"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-[#ECEEF1] text-[#333333]"
                        onClick={() => {
                          setPresence?.(status as "online" | "idle" | "dnd" | "offline");
                          setPresenceOpen(false);
                        }}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        {isEnglish ? cfg.label : cfg.labelFr}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mx-3 mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="shrink-0">⚠</span>
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 ml-1">×</button>
        </div>
      )}

      {/* Member list grouped by role category */}
      {membersLoading ? (
        <p className="text-sm text-[#8A929C] px-4 py-3">
          {isEnglish ? "Loading..." : "Chargement..."}
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto py-2">
          {grouped.map(({ label, members: groupMembers }) => (
            <div key={label}>
              {/* Category header */}
              <div className="flex items-center gap-1 px-4 pt-3 pb-1 text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
                {label} · {groupMembers.length}
              </div>

              {groupMembers.map((m) => {
                const memberIsOwner = m.role === "Owner";
                const isSelf = currentUser?.id === m.user_id;
                const canActOnMember = !memberIsOwner && !isSelf;
                // Show "..." only for users who have moderation rights
                const showMenu = canActOnMember && (isPedagoOrOwner || isModerator);
                // Role-change items only for PÉDAGO/Owner
                const canChangeRoleForMember = canActOnMember && isPedagoOrOwner;
                const showKick = canActOnMember && (isPedagoOrOwner || isModerator);
                const showBan = canActOnMember && (isPedagoOrOwner || isModerator);

                const presenceStatus = presence[m.user_id]?.status?.toLowerCase();
                const isOnline = presenceStatus === "online";
                const isDnd = presenceStatus === "dnd";

                return (
                  <div key={m.user_id} className="mx-2">
                    <div className="h-8 flex items-center gap-3 px-2 rounded hover:bg-[#ECEEF1] cursor-pointer group transition-colors duration-120">
                      {/* Avatar with presence dot */}
                      <div className="relative w-7 h-7 rounded-full shrink-0">
                        <div className="w-7 h-7 rounded-full bg-[#E6F0FB] flex items-center justify-center text-[11px] font-mono font-semibold text-[#003D82] overflow-hidden">
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
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#F5F5F5] ${
                            isOnline ? "bg-[#2BAE5C]" : isDnd ? "bg-[#D93F3F]" : "bg-[#8A929C]"
                          }`}
                        />
                      </div>

                      {/* Name */}
                      <span
                        className={`flex-1 truncate text-[13px] ${
                          isOnline || isDnd ? "text-[#333333]" : "text-[#8A929C]"
                        } ${loadingRole === m.user_id ? "opacity-50" : ""}`}
                      >
                        {m.username || "Utilisateur"}
                      </span>

                      {/* Role tag */}
                      <span className={`text-[10px] font-mono font-semibold tracking-wider ${ROLE_TAG_CLASS[m.role] ?? "text-[#6B737D]"}`}>
                        {ROLE_TAG[m.role] ?? m.role.slice(0, 3).toUpperCase()}
                      </span>

                      {/* Actions — visible on hover */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {currentUser && m.user_id !== currentUser.id && (
                          <button
                            onClick={() => { setActivePeer(m.user_id); router.push("/dm"); }}
                            title="Message privé"
                            className="w-6 h-6 rounded flex items-center justify-center text-[#8A929C] hover:bg-[#D5DAE0] hover:text-[#333333] transition-colors"
                          >
                            <i className="bi bi-chat-dots text-[12px]" />
                          </button>
                        )}
                        {showMenu && (
                          <MemberMenu
                            canChangeRole={canChangeRoleForMember}
                            showKick={showKick}
                            showBan={showBan}
                            onRolePedago={() => void onChangeRole(m.user_id, "Admin")}
                            onRoleStaff={() => void onChangeRole(m.user_id, "Moderator")}
                            onRoleMember={() => void onChangeRole(m.user_id, "Member")}
                            onKick={() => setKickTarget({ id: m.user_id, username: m.username })}
                            onBanTemporary={() => {
                              setBanTarget({ id: m.user_id, username: m.username, permanent: false });
                              setBanReason("");
                              setBanDurationValue(1);
                              setBanDurationUnit("hours");
                            }}
                            onBanPermanent={() => {
                              setBanTarget({ id: m.user_id, username: m.username, permanent: true });
                              setBanReason("");
                            }}
                            isEnglish={isEnglish}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Offline count footer */}
      {offlineCount > 0 && (
        <div className="px-4 py-3 text-[11px] text-[#8A929C] font-mono">
          +{offlineCount} hors ligne
        </div>
      )}

      {/* Hidden bans section — preserves ban/unban logic */}
      <div className="hidden">
        {loadingBans && <span />}
        {bans.map((ban) => (
          <div key={ban.id}>
            <span>{ban.username}</span>
            <span>{formatExpiry(ban.expires_at, isEnglish)}</span>
            {canBan && (
              <button
                onClick={() => onUnban(ban.user_id)}
                disabled={loadingUnban === ban.user_id}
              >
                {isEnglish ? "Unban" : "Débannir"}
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
