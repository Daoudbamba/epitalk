"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function UserSettings() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [isOpen, setIsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    router.push("/login");
  };

  const handleCopy = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <>
      {/* Settings Button - Style cohérent avec ServersRail */}
      <button
        onClick={() => user && setIsOpen(true)}
        className={`w-14 h-14 rounded-2xl border transition flex items-center justify-center ${
          !user
            ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
            : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
        }`}
        title={user ? "Paramètres utilisateur" : "Chargement..."}
        disabled={!user}
      >
        {user ? (
          <span className="text-lg font-semibold uppercase">
            {user.username.slice(0, 2)}
          </span>
        ) : (
          <span className="text-xl">👤</span>
        )}
      </button>

      {/* Modal Settings - Style identique aux paramètres serveur */}
      {isOpen && user && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="absolute left-1/2 top-1/2 w-[500px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#1f2023] border border-white/10 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 flex items-center">
              <div className="font-semibold">Paramètres utilisateur</div>
              <button
                className="ml-auto text-sm px-3 py-1 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition"
                onClick={() => setIsOpen(false)}
              >
                Fermer
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Profile Section */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                <div className="text-sm font-semibold mb-4">Mon Profil</div>

                {/* Avatar */}
                <div className="flex justify-center mb-4">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold uppercase">
                    {user.username.slice(0, 2)}
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="space-y-3">
                  {/* Username */}
                  <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 bg-black/5 dark:bg-white/5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Nom d&apos;utilisateur
                    </label>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-medium">{user.username}</span>
                      <button
                        onClick={() => handleCopy(user.username, "username")}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copier"
                      >
                        {copiedField === "username" ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 bg-black/5 dark:bg-white/5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Adresse email
                    </label>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-medium">{user.email}</span>
                      <button
                        onClick={() => handleCopy(user.email, "email")}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copier"
                      >
                        {copiedField === "email" ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* User ID */}
                  <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 bg-black/5 dark:bg-white/5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Identifiant utilisateur (ID)
                    </label>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-sm truncate pr-2">{user.id}</span>
                      <button
                        onClick={() => handleCopy(user.id, "id")}
                        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                        title="Copier"
                      >
                        {copiedField === "id" ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Created At (if available) */}
                  {user.created_at && (
                    <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 bg-black/5 dark:bg-white/5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Membre depuis
                      </label>
                      <div className="mt-1">
                        <span className="font-medium">
                          {new Date(user.created_at).toLocaleDateString("fr-FR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Logout Section */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
                <div className="text-sm font-semibold mb-2">Déconnexion</div>
                <div className="text-xs text-muted-foreground mb-3">
                  Se déconnecter de ton compte et retourner à la page de connexion.
                </div>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  className="w-full"
                >
                  Se déconnecter
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
