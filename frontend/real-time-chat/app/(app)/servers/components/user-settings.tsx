"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
    : "http://localhost:3001";

export function UserSettings() {
  const user = useAuthStore((s) => s.user);

  const avatarUrl = user?.avatar_url ? `${API_BASE}${user.avatar_url}` : null;

  return (
    <Link
      href="/settings"
      className={`relative w-10.5 h-10.5 rounded-full flex items-center justify-center overflow-hidden ${
        !user ? "bg-et-avatar-empty text-et-muted pointer-events-none" : ""
      }`}
      title={user ? "Paramètres utilisateur" : "Chargement..."}
    >
      {user ? (
        avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={user.username}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="w-full h-full bg-et-gradient flex items-center justify-center text-white text-[11px] font-bold uppercase">
            {user.username.slice(0, 2)}
          </span>
        )
      ) : (
        <i className="bi bi-person text-[17px] text-et-muted" />
      )}
    </Link>
  );
}
