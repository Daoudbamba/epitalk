"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  ArrowLeft,
  User,
  Shield,
  Bell,
  LogOut,
  Smile,
  ImageIcon,
  Play,
  Loader2,
  Search,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Palette,
  Sun,
  Moon,
  Monitor,
  Type,
} from "lucide-react";
import { useAppearanceStore, type Theme, type FontSize } from "@/store/appearance.store";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import type { UpdateProfileInput } from "@/lib/api/auth.api";

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
    : "http://localhost:8080";

const STATUS_OPTIONS = [
  { value: "ONLINE" as const, label: "Actif", color: "#22C55E", dot: "bg-green-500" },
  { value: "IDLE" as const, label: "Inactif", color: "#F59E0B", dot: "bg-amber-500" },
  { value: "DND" as const, label: "Silencieux", color: "#6B7280", dot: "bg-gray-500" },
  { value: "OFFLINE" as const, label: "Hors ligne", color: "#EF4444", dot: "bg-red-500" },
];

type Section = "profile" | "appearance" | "privacy" | "notifications";

const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "profile", label: "Profil", icon: <User className="w-4 h-4" /> },
  { key: "appearance", label: "Apparence", icon: <Palette className="w-4 h-4" /> },
  { key: "privacy", label: "Confidentialité", icon: <Shield className="w-4 h-4" /> },
  { key: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode; preview: string; desc: string }[] = [
  { value: "light", label: "Clair", icon: <Sun className="w-5 h-5" />, preview: "bg-white border-[#E5E7EB]", desc: "Thème lumineux par défaut" },
  { value: "ash", label: "Cendré", icon: <Monitor className="w-5 h-5" />, preview: "bg-[#E8E6E1] border-[#C5C2BB]", desc: "Gris chaud et reposant" },
  { value: "dim", label: "Sombre", icon: <Moon className="w-5 h-5" />, preview: "bg-[#1E2028] border-[#2F3340]", desc: "Sombre mais pas trop" },
  { value: "dark", label: "Dark", icon: <Moon className="w-5 h-5" />, preview: "bg-[#0F1117] border-[#1A1D26]", desc: "Noir profond" },
];

const FONT_SIZE_OPTIONS: { value: FontSize; label: string; example: string }[] = [
  { value: "sm", label: "Petit", example: "text-sm" },
  { value: "base", label: "Normal", example: "text-base" },
  { value: "lg", label: "Grand", example: "text-lg" },
  { value: "xl", label: "Très grand", example: "text-xl" },
];

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const disconnect = useWebSocketStore((s) => s.disconnect);

  const theme = (user?.theme as Theme) || "light";
  const fontSize = useAppearanceStore((s) => s.fontSize);
  const setFontSize = useAppearanceStore((s) => s.setFontSize);

  const handleSetTheme = async (t: Theme) => {
    try {
      const updated = await authApi.updateProfile({ theme: t });
      setUser(updated);
    } catch (e) {
      console.error("Failed to update theme", e);
    }
  };

  const [section, setSection] = useState<Section>("profile");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit form state
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editColor1, setEditColor1] = useState("#023BFC");
  const [editColor2, setEditColor2] = useState("#3D6AFF");
  const [editStatus, setEditStatus] = useState<"ONLINE" | "IDLE" | "DND" | "OFFLINE">("ONLINE");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Account data edit modals
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [emailRevealed, setEmailRevealed] = useState(false);

  // GIF picker state
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview?: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifPickerRef = useRef<HTMLDivElement>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Initialize form values from user
  const initForm = useCallback(() => {
    if (!user) return;
    setEditUsername(user.username);
    setEditBio(user.bio || "");
    setEditColor1(user.banner_color_1 || "#023BFC");
    setEditColor2(user.banner_color_2 || "#3D6AFF");
    setEditStatus(user.status || "ONLINE");
    setError(null);
  }, [user]);

  useEffect(() => {
    initForm();
  }, [initForm]);

  // Close emoji picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Close GIF picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
    }
    if (showGifPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showGifPicker]);

  // GIF search with debounce
  useEffect(() => {
    if (!showGifPicker) return;
    const query = gifQuery.trim() || "avatar";
    const controller = new AbortController();
    setGifLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/gifs/search?q=${encodeURIComponent(query)}&limit=20`,
          { signal: controller.signal },
        );
        if (!res.ok) { setGifResults([]); setGifLoading(false); return; }
        const json = await res.json();
        const results: { id: string; url: string; preview?: string }[] = [];
        if (json.results) {
          for (const it of json.results) {
            const url = it.url || "";
            const preview = it.preview || undefined;
            if (url) results.push({ id: (it.id || "").toString(), url, preview });
          }
        }
        setGifResults(results);
      } catch (err: unknown) {
        if (!(err instanceof DOMException) || err.name !== "AbortError") {
          setGifResults([]);
        }
      } finally {
        setGifLoading(false);
      }
    }, 300);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [gifQuery, showGifPicker]);

  // Select a GIF from the picker as avatar
  const handleGifSelect = async (gifUrl: string) => {
    setUploading(true);
    setError(null);
    try {
      const updated = await authApi.setAvatarFromUrl(gifUrl);
      setUser(updated);
      setShowGifPicker(false);
      setGifQuery("");
      setGifResults([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'application du GIF");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    disconnect();
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

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateProfileInput = {};
      if (editUsername !== user.username) payload.username = editUsername;
      if (editBio !== (user.bio || "")) payload.bio = editBio;
      if (editColor1 !== (user.banner_color_1 || "#023BFC")) payload.banner_color_1 = editColor1;
      if (editColor2 !== (user.banner_color_2 || "#3D6AFF")) payload.banner_color_2 = editColor2;
      if (editStatus !== (user.status || "ONLINE")) payload.status = editStatus;

      if (Object.keys(payload).length === 0) return;

      const updated = await authApi.updateProfile(payload);
      setUser(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const doUpload = async (file: File, inputRef: React.RefObject<HTMLInputElement | null>) => {
    setUploading(true);
    setError(null);
    try {
      const updated = await authApi.uploadAvatar(file);
      setUser(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowedMimes.includes(file.type) && !allowedExts.includes(ext)) {
      setError("Seuls les fichiers JPG, PNG et WebP sont acceptés pour les photos");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Le fichier doit faire moins de 10 Mo");
      return;
    }
    await doUpload(file, photoInputRef);
  };

  const handleEmojiSelect = (emoji: { native: string }) => {
    const textarea = bioRef.current;
    if (!textarea) {
      setEditBio((prev) => prev + emoji.native);
      setShowEmojiPicker(false);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBio = editBio.slice(0, start) + emoji.native + editBio.slice(end);
    if (newBio.length <= 500) {
      setEditBio(newBio);
      // Restore cursor position after emoji insert
      requestAnimationFrame(() => {
        const pos = start + emoji.native.length;
        textarea.setSelectionRange(pos, pos);
        textarea.focus();
      });
    }
    setShowEmojiPicker(false);
  };

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#023BFC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = user.avatar_url ? `${API_BASE}${user.avatar_url}` : null;
  const isGifAvatar = !!user.avatar_url && user.avatar_url.toLowerCase().endsWith(".gif");
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === (user.status || "ONLINE"));

  return (
    <div className="h-full flex bg-[var(--surface)]">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--card)] border-r border-[var(--border)] flex flex-col">
        {/* Back */}
        <div className="p-4 border-b border-[var(--border)]">
          <Link
            href="/servers"
            className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[#023BFC] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>

        {/* User mini card */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold uppercase">
                  {user.username.slice(0, 2)}
                </span>
              )}
              {currentStatus && (
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--card)] ${currentStatus.dot}`} />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--foreground)] truncate">{user.username}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{currentStatus?.label}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                section === item.key
                  ? "bg-[#023BFC]/10 text-[#023BFC]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        {section === "profile" && (
          <div className="max-w-2xl mx-auto p-8 space-y-8">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Mon profil</h1>

            {/* Banner + Avatar side by side */}
            <div className="flex gap-4 items-start">
              {/* Banner rectangle */}
              <div className="flex-1">
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-2 block">Bannière</label>
                <div
                  className="h-28 rounded-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${user.banner_color_1 || "#023BFC"}, ${user.banner_color_2 || "#3D6AFF"})`,
                  }}
                />
              </div>
              {/* Avatar square */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-2 block">Avatar</label>
                <div className="relative w-28 h-28">
                  <div className="w-28 h-28 rounded-2xl border-2 border-[var(--border)] shadow-lg overflow-hidden bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-3xl font-bold uppercase">
                        {user.username.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-black/0 hover:bg-black/50 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-all">
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploading}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 transition-colors cursor-pointer"
                      title="Changer la photo"
                    >
                      <ImageIcon className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={() => { setShowGifPicker((v) => !v); setGifQuery(""); }}
                      disabled={uploading}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 transition-colors cursor-pointer"
                      title="Choisir un GIF animé"
                    >
                      <Play className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  {isGifAvatar && (
                    <span className="absolute top-1 left-1 bg-[#7C3AED] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none shadow">
                      GIF
                    </span>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {currentStatus && (
                    <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-3 border-[var(--card)] ${currentStatus.dot}`} />
                  )}
                </div>
              </div>
            </div>

            {/* Aperçu du profil */}
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-3 block">
                Aperçu — tel que vu par les autres
              </label>
              <div className="flex gap-6 items-start">
                {/* Normal / full card preview */}
                <div className="w-72 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden flex-shrink-0">
                  <div
                    className="h-20"
                    style={{
                      background: `linear-gradient(135deg, ${user.banner_color_1 || "#023BFC"}, ${user.banner_color_2 || "#3D6AFF"})`,
                    }}
                  />
                  <div className="px-4 -mt-8 pb-4">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 rounded-full border-4 border-[var(--card)] shadow overflow-hidden bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-xl font-bold uppercase">
                            {user.username.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      {currentStatus && (
                        <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[var(--card)] ${currentStatus.dot}`} />
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="font-bold text-[var(--foreground)]">{user.username}</div>
                      {user.bio && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-1 whitespace-pre-wrap line-clamp-3">{user.bio}</p>
                      )}
                      {user.created_at && (
                        <div className="mt-2 pt-2 border-t border-[var(--border)]">
                          <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Membre depuis</span>
                          <div className="text-xs font-medium text-[var(--foreground)]">
                            {new Date(user.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mini preview (member list style) */}
                <div className="flex-1 space-y-3">
                  <span className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Vue compacte</span>
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-xs font-bold uppercase">
                            {user.username.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      {currentStatus && (
                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--card)] ${currentStatus.dot}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--foreground)] truncate">{user.username}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">{currentStatus?.label}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Account Data — Discord style */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              {/* Username row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Nom d&apos;utilisateur</div>
                  <div className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{user.username}</div>
                </div>
              </div>

              {/* Email row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">E-mail</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {emailRevealed
                        ? user.email
                        : user.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(b.length) + c)}
                    </span>
                    <button
                      onClick={() => setEmailRevealed((v) => !v)}
                      className="text-[#023BFC] text-xs font-medium hover:underline"
                    >
                      {emailRevealed ? "Masquer" : "Afficher"}
                    </button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingEmail(true); setNewEmail(user.email); setEmailPassword(""); setError(null); }}
                  className="rounded-lg border-[var(--border)] text-[var(--foreground)] text-xs h-8 px-3"
                >
                  Modifier
                </Button>
              </div>

              {/* Password row */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div>
                  <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Mot de passe</div>
                  <div className="mt-0.5 text-sm text-[var(--foreground)]">••••••••••</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingPassword(true); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setError(null); }}
                  className="rounded-lg border-[var(--border)] text-[var(--foreground)] text-xs h-8 px-3"
                >
                  Modifier
                </Button>
              </div>

              {/* Member since row */}
              {user.created_at && (
                <div className="px-5 py-4">
                  <div className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Membre depuis</div>
                  <div className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
                    {new Date(user.created_at).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Email edit modal */}
            {editingEmail && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#023BFC]/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-[#023BFC]" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--foreground)]">Modifier l&apos;adresse e-mail</h3>
                  </div>
                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Nouvelle adresse e-mail</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Mot de passe actuel</label>
                    <div className="relative mt-1">
                      <input
                        type={showEmailPassword ? "text" : "password"}
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => { setEditingEmail(false); setError(null); }}
                      className="rounded-xl border-[var(--border)] text-[var(--muted-foreground)]"
                    >
                      Annuler
                    </Button>
                    <Button
                      disabled={accountSaving || !newEmail || !emailPassword}
                      onClick={async () => {
                        setAccountSaving(true);
                        setError(null);
                        try {
                          const updated = await authApi.changeEmail(newEmail, emailPassword);
                          setUser(updated);
                          setEditingEmail(false);
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : "Erreur lors du changement d'email");
                        } finally {
                          setAccountSaving(false);
                        }
                      }}
                      className="rounded-xl bg-[#023BFC] hover:bg-[#023BFC]/90 text-white"
                    >
                      {accountSaving ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Password edit modal */}
            {editingPassword && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#023BFC]/10 flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-[#023BFC]" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--foreground)]">Modifier le mot de passe</h3>
                  </div>
                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Mot de passe actuel</label>
                    <div className="relative mt-1">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Nouveau mot de passe</label>
                    <div className="relative mt-1">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20"
                        placeholder="Min. 8 caractères"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => { setEditingPassword(false); setError(null); }}
                      className="rounded-xl border-[var(--border)] text-[var(--muted-foreground)]"
                    >
                      Annuler
                    </Button>
                    <Button
                      disabled={accountSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                      onClick={async () => {
                        if (newPassword !== confirmPassword) {
                          setError("Les mots de passe ne correspondent pas");
                          return;
                        }
                        setAccountSaving(true);
                        setError(null);
                        try {
                          const updated = await authApi.changePassword(currentPassword, newPassword);
                          setUser(updated);
                          setEditingPassword(false);
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : "Erreur lors du changement de mot de passe");
                        } finally {
                          setAccountSaving(false);
                        }
                      }}
                      className="rounded-xl bg-[#023BFC] hover:bg-[#023BFC]/90 text-white"
                    >
                      {accountSaving ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-[var(--border)]" />

            {/* Edit form */}
            <h2 className="text-lg font-bold text-[var(--foreground)]">Modifier le profil</h2>

            <div className="space-y-5">
              {/* Username */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  Nom d&apos;utilisateur
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  maxLength={32}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20 transition-all"
                />
              </div>

              {/* Bio / Notes with emoji picker */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  Notes / Bio
                </label>
                <div className="relative">
                  <textarea
                    ref={bioRef}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Écris quelque chose à propos de toi..."
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[#023BFC] focus:ring-2 focus:ring-[#023BFC]/20 transition-all resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="absolute right-2 top-3 p-1.5 rounded-lg hover:bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[#023BFC] transition-colors"
                    title="Ajouter un emoji"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute right-0 top-full mt-1 z-50">
                      <Picker
                        data={data}
                        onEmojiSelect={handleEmojiSelect}
                        theme="light"
                        locale="fr"
                        previewPosition="none"
                        skinTonePosition="search"
                      />
                    </div>
                  )}
                </div>
                <div className="text-xs text-[var(--muted-foreground)] mt-1 text-right">{editBio.length}/500</div>
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  Statut
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setEditStatus(opt.value)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        editStatus === opt.value
                          ? "border-[#023BFC] bg-[#023BFC]/5 text-[#023BFC]"
                          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[#023BFC]/30"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${opt.dot}`} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Banner Colors */}
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  Couleurs de la bannière
                </label>
                <div
                  className="mt-2 h-14 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${editColor1}, ${editColor2})`,
                  }}
                />
                <div className="flex gap-3 mt-2">
                  <div className="flex-1">
                    <label className="text-xs text-[var(--muted-foreground)]">Couleur 1</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={editColor1}
                        onChange={(e) => setEditColor1(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-[var(--border)] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editColor1}
                        onChange={(e) => setEditColor1(e.target.value)}
                        maxLength={7}
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[#023BFC]"
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-[var(--muted-foreground)]">Couleur 2</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={editColor2}
                        onChange={(e) => setEditColor2(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-[var(--border)] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={editColor2}
                        onChange={(e) => setEditColor2(e.target.value)}
                        maxLength={7}
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs font-mono text-[var(--foreground)] outline-none focus:border-[#023BFC]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Avatar upload */}
              <div className="relative">
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                  Photo de profil
                </label>
                <div className="mt-2 flex items-center gap-3">
                  {/* Current avatar preview */}
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-[#023BFC] to-[#3D6AFF] flex items-center justify-center flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-lg font-bold uppercase">
                        {user.username.slice(0, 2)}
                      </span>
                    )}
                    {isGifAvatar && (
                      <span className="absolute top-0.5 left-0.5 bg-[#7C3AED] text-white text-[8px] font-bold px-1 py-0.5 rounded leading-none">
                        GIF
                      </span>
                    )}
                  </div>

                  {/* Two buttons: Photo (file) + GIF (picker) */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={uploading}
                        variant="outline"
                        className="rounded-xl border-[var(--border)] hover:border-[#023BFC] hover:bg-[#023BFC]/5 text-[var(--foreground)] text-sm px-3 h-9 gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        {uploading ? "Upload..." : "Photo"}
                      </Button>
                      <Button
                        onClick={() => { setShowGifPicker((v) => !v); setGifQuery(""); }}
                        disabled={uploading}
                        variant="outline"
                        className={`rounded-xl text-sm px-3 h-9 gap-2 ${
                          showGifPicker
                            ? "border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED]"
                            : "border-[var(--border)] hover:border-[#7C3AED] hover:bg-[#7C3AED]/5 text-[var(--foreground)]"
                        }`}
                      >
                        <Play className="w-4 h-4" />
                        GIF animé
                      </Button>
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      Photo : fichier JPG, PNG, WebP — GIF : recherche Tenor / Giphy
                    </span>
                  </div>
                </div>

                {/* GIF Picker Panel */}
                {showGifPicker && (
                  <div ref={gifPickerRef} className="mt-3 rounded-2xl border border-[#7C3AED]/30 bg-[var(--card)] shadow-lg overflow-hidden">
                    {/* Search bar */}
                    <div className="flex items-center gap-2 p-3 border-b border-[var(--border)]">
                      <Search className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" />
                      <input
                        value={gifQuery}
                        onChange={(e) => setGifQuery(e.target.value)}
                        placeholder="Rechercher un GIF (ex: cat, hello, dance...)"
                        autoFocus
                        className="flex-1 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] outline-none bg-transparent"
                      />
                      {gifLoading && <Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin flex-shrink-0" />}
                      <button
                        onClick={() => { setShowGifPicker(false); setGifQuery(""); setGifResults([]); }}
                        className="p-1 rounded-lg hover:bg-[var(--surface)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Results grid */}
                    <div className="p-2 grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
                      {gifResults.length === 0 && !gifLoading && (
                        <div className="col-span-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                          {gifQuery ? "Aucun GIF trouvé" : "Tapez pour rechercher des GIFs"}
                        </div>
                      )}
                      {gifResults.map((g) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={g.id}
                          src={g.preview || g.url}
                          alt="gif"
                          className="h-20 w-full object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-[#7C3AED] transition-all"
                          onClick={() => handleGifSelect(g.url)}
                        />
                      ))}
                    </div>
                    {uploading && (
                      <div className="p-3 border-t border-[var(--border)] flex items-center justify-center gap-2 text-sm text-[#7C3AED]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Application du GIF...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hidden file input for photos */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />

              {/* Save */}
              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#023BFC] to-[#3D6AFF] hover:from-[#023BFC]/90 hover:to-[#3D6AFF]/90 text-white border-0 shadow-lg"
              >
                {saving ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </div>
        )}

        {section === "appearance" && (
          <div className="max-w-2xl mx-auto p-8 space-y-8">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Apparence</h1>

            {/* Theme selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[var(--muted-foreground)]" />
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Thème</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSetTheme(opt.value)}
                      className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-200 ${
                        active
                          ? "border-[#023BFC] ring-2 ring-[#023BFC]/20"
                          : "border-[var(--border)] hover:border-[#023BFC]/40"
                      }`}
                    >
                      <div className={`w-full h-16 rounded-xl ${opt.preview} border mb-3`} />
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--muted-foreground)]">{opt.icon}</span>
                        <span className="font-semibold text-sm text-[var(--foreground)]">{opt.label}</span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">{opt.desc}</p>
                      {active && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#023BFC] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font size selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-[var(--muted-foreground)]" />
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Taille de la police</h2>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                {FONT_SIZE_OPTIONS.map((opt) => {
                  const active = fontSize === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setFontSize(opt.value)}
                      className={`w-full flex items-center justify-between px-5 py-4 border-b border-[var(--border)] last:border-b-0 transition-all ${
                        active ? "bg-[#023BFC]/5" : "hover:bg-[var(--surface)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          active ? "border-[#023BFC]" : "border-[var(--border)]"
                        }`}>
                          {active && <div className="w-2.5 h-2.5 rounded-full bg-[#023BFC]" />}
                        </div>
                        <span className={`font-medium text-[var(--foreground)] ${opt.example}`}>{opt.label}</span>
                      </div>
                      <span className={`text-[var(--muted-foreground)] ${opt.example}`}>Aa</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                La taille de police s&apos;applique aux messages et au contenu du serveur.
              </p>
            </div>
          </div>
        )}

        {section === "privacy" && (
          <div className="max-w-2xl mx-auto p-8 space-y-6">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Confidentialité</h1>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center space-y-3">
              <Shield className="w-12 h-12 mx-auto text-[var(--muted-foreground)]/40" />
              <p className="text-[var(--muted-foreground)] text-sm">
                Les paramètres de confidentialité seront bientôt disponibles.
              </p>
            </div>
          </div>
        )}

        {section === "notifications" && (
          <div className="max-w-2xl mx-auto p-8 space-y-6">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Notifications</h1>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center space-y-3">
              <Bell className="w-12 h-12 mx-auto text-[var(--muted-foreground)]/40" />
              <p className="text-[var(--muted-foreground)] text-sm">
                Les paramètres de notification seront bientôt disponibles.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** Helper: readonly info field with copy button */
function InfoField({
  label,
  value,
  field,
  copiedField,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (value: string, field: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-3 bg-[var(--card)]">
      <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">{label}</label>
      <div className="flex items-center justify-between mt-1">
        <span className={`${mono ? "font-mono text-sm truncate pr-2" : "font-semibold"} text-[var(--foreground)]`}>{value}</span>
        <button
          onClick={() => onCopy(value, field)}
          className="text-[var(--muted-foreground)] hover:text-[#023BFC] transition-colors flex-shrink-0"
          title="Copier"
        >
          {copiedField === field ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
