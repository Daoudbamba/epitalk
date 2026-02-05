"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/store/server.store";
import { useAuthStore } from "@/store/auth.store";
import { useMemberStore } from "@/store/member.store";
import { serversApi } from "@/lib/api";

export function MembersPanel({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const currentUser = useAuthStore((s) => s.user);
  const members = useMemberStore((s) => s.members);
  const setMembers = useMemberStore((s) => s.setMembers);
  const membersLoading = useMemberStore((s) => s.loading);
  const setMembersLoading = useMemberStore((s) => s.setLoading);

  const server = useMemo(
    () => servers.find((s) => s.id === activeServerId) ?? null,
    [servers, activeServerId]
  );

  const [loadingKick, setLoadingKick] = useState<string | null>(null);

  // Load members when server changes
  useEffect(() => {
    if (!activeServerId) {
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
      }
    };

    loadMembers();
  }, [activeServerId, setMembers, setMembersLoading]);

  const onKick = async (memberId: string) => {
    if (!server) return;

    const ok = confirm("Expulser ce membre ?");
    if (!ok) return;

    setLoadingKick(memberId);
    try {
      await serversApi.kickMember(server.id, memberId);
      // Reload members
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

  if (!server) {
    return (
      <aside className="w-64 border-l p-4">
        <h3 className="text-sm font-semibold mb-4">Membres</h3>
        <p className="text-sm text-muted-foreground">Aucun serveur sélectionné</p>
      </aside>
    );
  }

  const isOwner = !!currentUser && server.owner_id === currentUser.id;

  return (
    <aside className="h-[95%] rounded-md my-5 mb-30 border-2 border-gray-200 w-64 border-l p-4">
      <h3 className="text-sm font-semibold mb-1">
        Membres ({membersLoading ? "..." : members.length})
      </h3>

      <p className="text-xs text-muted-foreground mb-4">
        Rôle : {isOwner ? "Créateur" : "Membre"}
      </p>

      {membersLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {members.map((m) => {
            const memberIsOwner = m.role === "owner";

            return (
              <li key={m.user_id} className="flex items-center gap-2">
                <span className="flex-1">
                  {m.username || "Utilisateur"} {memberIsOwner ? "(Créateur)" : `(${m.role})`}
                </span>

                {isOwner && !memberIsOwner && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onKick(m.user_id)}
                    disabled={loadingKick === m.user_id}
                    title="Expulser"
                  >
                    {loadingKick === m.user_id ? "..." : "×"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
