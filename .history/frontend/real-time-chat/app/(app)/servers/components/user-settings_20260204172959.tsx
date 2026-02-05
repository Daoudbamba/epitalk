"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Settings, User, LogOut, X, Copy, Check } from "lucide-react";

export function UserSettings() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
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

  // Toujours afficher le bouton, même sans user
  return (
    <div className="relative">
      {/* Settings Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => user && setIsOpen(!isOpen)}
        className="h-9 w-9 p-0"
        title={user ? "Paramètres" : "Chargement..."}
        disabled={!user}
      >
        <Settings className={`h-5 w-5 ${!user ? "opacity-50" : ""}`} />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              setShowProfile(false);
            }}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border bg-background shadow-lg z-50">
            {/* Header */}
            <div className="border-b px-4 py-3">
              <p className="font-medium text-sm">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              {/* Profile Button */}
              <button
                onClick={() => setShowProfile(true)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <User className="h-4 w-4" />
                <span>Mon profil</span>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-red-50 text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <>
          {/* Modal Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowProfile(false)}
          />

          {/* Modal Content */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
            <div className="bg-background rounded-lg border shadow-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="text-lg font-semibold">Mon Profil</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProfile(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Avatar Placeholder */}
                <div className="flex justify-center">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold uppercase">
                    {user.username.slice(0, 2)}
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="space-y-3">
                  {/* Username */}
                  <div className="rounded-lg border p-3">
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
                  <div className="rounded-lg border p-3">
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
                  <div className="rounded-lg border p-3">
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
                    <div className="rounded-lg border p-3">
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

              {/* Modal Footer */}
              <div className="border-t px-6 py-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowProfile(false)}
                >
                  Fermer
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
