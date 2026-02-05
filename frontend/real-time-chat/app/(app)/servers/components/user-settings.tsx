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
      {/* Settings Button - Premium style cohérent avec ServersRail */}
      <button
        onClick={() => user && setIsOpen(true)}
        className={`w-12 h-12 rounded-2xl border-2 transition-all duration-300 flex items-center justify-center ${
          !user
            ? "bg-[#F7F8FA] border-[#E5E7EB] text-[#6B7280] cursor-not-allowed"
            : "bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] border-[#023BFC]/30 text-white shadow-lg hover:shadow-xl hover:scale-105"
        }`}
        title={user ? "Paramètres utilisateur" : "Chargement..."}
        disabled={!user}
      >
        {user ? (
          <span className="text-sm font-bold uppercase">
            {user.username.slice(0, 2)}
          </span>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        )}
      </button>

      {/* Modal Settings - Premium glassmorphism style */}
      {isOpen && user && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="absolute left-1/2 top-1/2 w-[500px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl overflow-hidden">
            {/* Header with gradient */}
            <div className="h-1.5 bg-gradient-to-r from-[#023BFC] via-[#3D6AFF] to-[#023BFC]" />
            <div className="px-6 py-5 border-b border-[#E5E7EB]/50 flex items-center bg-gradient-to-r from-[#023BFC]/5 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-[#1A1A2E]">Paramètres utilisateur</div>
                  <div className="text-xs text-[#6B7280]">Gérer ton profil et préférences</div>
                </div>
              </div>
              <button
                className="ml-auto w-9 h-9 rounded-xl bg-[#F7F8FA] hover:bg-[#E5E7EB] border border-[#E5E7EB] flex items-center justify-center transition-all duration-300"
                onClick={() => setIsOpen(false)}
                title="Fermer"
              >
                <svg className="w-4 h-4 text-[#6B7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Profile Section */}
              <div className="rounded-2xl border border-[#E5E7EB]/50 p-5 bg-white/50 hover:bg-white/70 transition-all duration-300">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="text-sm font-bold text-[#1A1A2E]">Mon Profil</div>
                </div>

                {/* Avatar */}
                <div className="flex justify-center mb-5">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center text-white text-2xl font-bold uppercase shadow-lg">
                    {user.username.slice(0, 2)}
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="space-y-3">
                  {/* Username */}
                  <div className="rounded-xl border border-[#E5E7EB] p-3 bg-[#F7F8FA]">
                    <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                      Nom d&apos;utilisateur
                    </label>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-semibold text-[#1A1A2E]">{user.username}</span>
                      <button
                        onClick={() => handleCopy(user.username, "username")}
                        className="text-[#6B7280] hover:text-[#023BFC] transition-colors"
                        title="Copier"
                      >
                        {copiedField === "username" ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="rounded-xl border border-[#E5E7EB] p-3 bg-[#F7F8FA]">
                    <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                      Adresse email
                    </label>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-semibold text-[#1A1A2E]">{user.email}</span>
                      <button
                        onClick={() => handleCopy(user.email, "email")}
                        className="text-[#6B7280] hover:text-[#023BFC] transition-colors"
                        title="Copier"
                      >
                        {copiedField === "email" ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* User ID */}
                  <div className="rounded-xl border border-[#E5E7EB] p-3 bg-[#F7F8FA]">
                    <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                      Identifiant utilisateur (ID)
                    </label>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono text-sm truncate pr-2 text-[#1A1A2E]">{user.id}</span>
                      <button
                        onClick={() => handleCopy(user.id, "id")}
                        className="text-[#6B7280] hover:text-[#023BFC] transition-colors flex-shrink-0"
                        title="Copier"
                      >
                        {copiedField === "id" ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Created At (if available) */}
                  {user.created_at && (
                    <div className="rounded-xl border border-[#E5E7EB] p-3 bg-[#F7F8FA]">
                      <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                        Membre depuis
                      </label>
                      <div className="mt-1">
                        <span className="font-semibold text-[#1A1A2E]">
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
              <div className="rounded-2xl border border-red-200/50 p-5 bg-red-50/30 hover:bg-red-50/50 transition-all duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div className="text-sm font-bold text-red-700">Déconnexion</div>
                </div>
                <div className="text-xs text-red-600/80 mb-4">
                  Se déconnecter de ton compte et retourner à la page de connexion.
                </div>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-0 shadow-lg"
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
