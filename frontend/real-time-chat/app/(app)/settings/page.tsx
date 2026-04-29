"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useWebSocketStore } from "@/store/websocket.store";
import { authApi } from "@/lib/api";
import {
  Check,
  ChevronLeft,
  User,
  LogOut,
  Smile,
  ImageIcon,
  Palette,
  Sun,
  Moon,
  Monitor,
  Type,
} from "lucide-react";
import { useAppearanceStore, type Theme, type FontSize } from "@/store/appearance.store";
import { useLanguage } from "@/components/language-provider";
import { getSettingsNavLabel } from "@/lib/settings-i18n";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import type { UpdateProfileInput } from "@/lib/api/auth.api";

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
    : "http://localhost:3001";

type Section = "profile" | "appearance";

const NAV_ITEMS: { key: Section; icon: React.ReactNode }[] = [
  { key: "profile", icon: <User className="w-4 h-4" /> },
  { key: "appearance", icon: <Palette className="w-4 h-4" /> },
];

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode; preview: string; desc: string }[] = [
  { value: "light", label: "Clair", icon: <Sun size={14} />, preview: "bg-white", desc: "Thème lumineux par défaut" },
  { value: "ash", label: "Cendré", icon: <Monitor size={14} />, preview: "bg-[#E8E4DE]", desc: "Gris chaud et reposant" },
  { value: "dim", label: "Sombre", icon: <Moon size={14} />, preview: "bg-[#2A2A2A]", desc: "Sombre mais pas trop" },
  { value: "dark", label: "Dark", icon: <Moon size={14} />, preview: "bg-[#111111]", desc: "Noir profond" },
];

const FONT_SIZE_OPTIONS: { value: FontSize; label: string; aaSize: string }[] = [
  { value: "sm", label: "Petit", aaSize: "text-[12px]" },
  { value: "base", label: "Normal", aaSize: "text-[14px]" },
  { value: "lg", label: "Grand", aaSize: "text-[16px]" },
  { value: "xl", label: "Très grand", aaSize: "text-[18px]" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const isEnglish = language === "en";
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const disconnect = useWebSocketStore((s) => s.disconnect);

  const theme = useAppearanceStore((s) => s.theme);
  const setTheme = useAppearanceStore((s) => s.setTheme);
  const fontSize = useAppearanceStore((s) => s.fontSize);
  const setFontSize = useAppearanceStore((s) => s.setFontSize);

  const handleSetTheme = async (t: Theme) => {
    setTheme(t);
    try {
      const updated = await authApi.updateProfile({ theme: t });
      setUser(updated);
    } catch (e) {
      console.error("Failed to update theme", e);
    }
  };

  const [section, setSection] = useState<Section>("profile");

  // Edit form state
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editColor1, setEditColor1] = useState("#023BFC");
  const [editColor2, setEditColor2] = useState("#3D6AFF");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const initForm = useCallback(() => {
    if (!user) return;
    setEditUsername(user.username);
    setEditBio(user.bio || "");
    setEditColor1(user.banner_color_1 || "#023BFC");
    setEditColor2(user.banner_color_2 || "#3D6AFF");
    setError(null);
  }, [user]);

  useEffect(() => {
    initForm();
  }, [initForm]);

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

  const navLabelBySection: Record<Section, string> = {
    profile: getSettingsNavLabel(language, "profile"),
    appearance: getSettingsNavLabel(language, "appearance"),
  };

  const handleLogout = () => {
    disconnect();
    logout();
    router.push("/login");
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

      if (Object.keys(payload).length === 0) return;

      const updated = await authApi.updateProfile(payload);
      setUser(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : isEnglish ? "Error while saving" : "Erreur lors de la sauvegarde");
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
      setError(e instanceof Error ? e.message : isEnglish ? "Upload error" : "Erreur lors de l'upload");
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
      <div className="h-screen w-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="w-8 h-8 border-2 border-[#0066CC] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avatarUrl = user.avatar_url ? `${API_BASE}${user.avatar_url}` : null;
  const bannerGradient = `linear-gradient(to right, ${user.banner_color_1 || "#023BFC"}, ${user.banner_color_2 || "#3D6AFF"})`;
  const avatarBg = `linear-gradient(135deg, ${user.banner_color_1 || "#023BFC"}, ${user.banner_color_2 || "#3D6AFF"})`;

  const sectionSubtitle =
    section === "profile"
      ? isEnglish ? "Identity, banner, profile picture" : "Identité, bannière, photo de profil"
      : isEnglish ? "Theme and font size" : "Thème et taille de la police";

  const sectionIcon =
    section === "profile" ? <User className="w-4 h-4" /> : <Palette className="w-4 h-4" />;

  const sectionTitle =
    section === "profile"
      ? isEnglish ? "Profile" : "Profil"
      : isEnglish ? "Appearance" : "Apparence";

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#FAFBFC] p-5">
      <div className="flex h-full gap-5">

        {/* ── Left panel ── */}
        <aside className="w-[240px] flex-shrink-0 bg-[#003D82] rounded-xl border border-[#D5DAE0] shadow-[0_1px_2px_rgba(15,24,40,0.04)] overflow-hidden flex flex-col h-full">

          {/* Back */}
          <button
            onClick={() => router.push("/servers")}
            className="mx-3 mt-3 flex items-center gap-2 h-9 px-3 rounded bg-[rgba(255,255,255,0.08)] text-white text-[13px] hover:bg-[rgba(255,255,255,0.16)] transition-colors"
          >
            <ChevronLeft size={14} />
            {isEnglish ? "Back" : "Retour"}
          </button>

          {/* Avatar + user info */}
          <div className="mt-4 px-4 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: avatarBg }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-mono text-[14px] font-semibold">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="text-white text-[14px] font-semibold">{user.username}</div>
              {user.created_at && (
                <div className="text-[rgba(255,255,255,0.6)] text-[12px]">
                  {isEnglish ? "Since" : "Depuis"} {new Date(user.created_at).getFullYear()}
                </div>
              )}
            </div>
          </div>

          {/* Section label */}
          <div className="mt-6 px-4 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[rgba(255,255,255,0.4)]">
              {isEnglish ? "Account" : "Compte"}
            </span>
          </div>

          {/* Nav items */}
          <nav className="px-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`flex items-center gap-3 h-9 px-3 rounded text-[14px] transition-colors ${
                  section === item.key
                    ? "bg-[#0066CC] text-white font-medium"
                    : "text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.08)]"
                }`}
              >
                {item.icon}
                {navLabelBySection[item.key]}
              </button>
            ))}
          </nav>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="mt-auto mb-4 mx-3 flex items-center gap-2 h-9 px-3 rounded text-[#FF6B35] text-[13px] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
          >
            <LogOut size={14} />
            {isEnglish ? "Sign out" : "Se déconnecter"}
          </button>
        </aside>

        {/* ── Right panel ── */}
        <main className="flex-1 min-w-0 bg-white rounded-xl border border-[#D5DAE0] shadow-[0_1px_2px_rgba(15,24,40,0.04)] overflow-hidden flex flex-col h-full">

          {/* Header */}
          <div className="h-14 flex-shrink-0 flex items-center gap-3 px-8 border-b border-[#D5DAE0]">
            <span className="flex items-center gap-2 text-[#0066CC] font-semibold text-[15px]">
              {sectionIcon}
              {sectionTitle}
            </span>
            <div className="w-px h-5 bg-[#D5DAE0]" />
            <span className="text-[#8A929C] text-[13px] font-mono">{sectionSubtitle}</span>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 py-8">

            {/* ── Profile tab ── */}
            {section === "profile" && (
              <div className="space-y-8">

                {/* Mon profil */}
                <section>
                  <h2 className="text-[18px] font-semibold text-[#003D82] mb-4">
                    {isEnglish ? "My profile" : "Mon profil"}
                  </h2>
                  <div className="border border-[#D5DAE0] rounded-lg overflow-hidden">
                    <div className="h-24" style={{ background: bannerGradient }} />
                    <div className="relative -mt-10 ml-6 z-10 inline-block">
                      <div
                        className="w-20 h-20 rounded-full border-4 border-white overflow-hidden flex items-center justify-center"
                        style={{ background: !avatarUrl ? avatarBg : undefined }}
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-2xl font-bold uppercase">
                            {user.username.slice(0, 1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-6 pb-4 pt-2">
                      <div className="text-[16px] font-semibold text-[#003D82]">{user.username}</div>
                      {user.created_at && (
                        <>
                          <div className="text-[11px] font-mono uppercase text-[#8A929C] mt-1">
                            {isEnglish ? "Member since" : "Membre depuis"}
                          </div>
                          <div className="text-[13px] font-semibold text-[#333333]">
                            {new Date(user.created_at).toLocaleDateString(
                              isEnglish ? "en-US" : "fr-FR",
                              { year: "numeric", month: "long", day: "numeric" }
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>

                {/* Aperçu */}
                <section>
                  <h2 className="text-[18px] font-semibold text-[#003D82] mb-4">
                    {isEnglish ? "Preview — as seen by others" : "Aperçu — tel que vu par les autres"}
                  </h2>
                  <div className="flex gap-4 items-start">

                    {/* Full card */}
                    <div className="w-56 border border-[#D5DAE0] rounded-lg overflow-hidden flex-shrink-0">
                      <div className="h-16" style={{ background: bannerGradient }} />
                      <div className="relative -mt-6 ml-4">
                        <div
                          className="w-12 h-12 rounded-full border-2 border-white overflow-hidden flex items-center justify-center"
                          style={{ background: !avatarUrl ? avatarBg : undefined }}
                        >
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-sm font-bold uppercase">
                              {user.username.slice(0, 1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="px-4 pb-3 pt-1">
                        <div className="text-[14px] font-semibold text-[#333333]">{user.username}</div>
                        {user.created_at && (
                          <>
                            <div className="text-[10px] font-mono uppercase text-[#8A929C] mt-2">
                              {isEnglish ? "Member since" : "Membre depuis"}
                            </div>
                            <div className="text-[13px] font-semibold text-[#333333]">
                              {new Date(user.created_at).toLocaleDateString(
                                isEnglish ? "en-US" : "fr-FR",
                                { year: "numeric", month: "long", day: "numeric" }
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Compact view */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-mono uppercase text-[#8A929C]">
                        {isEnglish ? "Compact view" : "Vue compacte"}
                      </span>
                      <div className="border border-[#D5DAE0] rounded-lg px-3 py-2 flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                          style={{ background: !avatarUrl ? avatarBg : undefined }}
                        >
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xs font-bold uppercase">
                              {user.username.slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <span className="text-[14px] text-[#333333]">{user.username}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Edit form */}
                <section>
                  <h2 className="text-[18px] font-semibold text-[#003D82] mb-6">
                    {isEnglish ? "Edit profile" : "Modifier le profil"}
                  </h2>
                  <div className="space-y-5">

                    {/* Username */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2">
                        {isEnglish ? "Username" : "Nom d'utilisateur"}
                      </label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        maxLength={32}
                        className="w-full h-10 px-3 rounded border border-[#D5DAE0] text-[14px] outline-none focus:border-[#0066CC] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] transition-all"
                      />
                    </div>

                    {/* Bio */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2">
                        {isEnglish ? "Notes / Bio" : "Notes / Bio"}
                      </label>
                      <div className="relative">
                        <textarea
                          ref={bioRef}
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          maxLength={500}
                          rows={3}
                          placeholder={isEnglish ? "Write something about yourself..." : "Écris quelque chose à propos de toi..."}
                          className="w-full min-h-[96px] px-3 py-2 rounded border border-[#D5DAE0] text-[14px] resize-none outline-none focus:border-[#0066CC] focus:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker((v) => !v)}
                          className="absolute right-2 top-2 p-1.5 rounded hover:bg-[#F5F7FA] text-[#8A929C] hover:text-[#0066CC] transition-colors"
                        >
                          <Smile className="w-4 h-4" />
                        </button>
                        {showEmojiPicker && (
                          <div ref={emojiPickerRef} className="absolute right-0 top-full mt-1 z-50">
                            <Picker
                              data={data}
                              onEmojiSelect={handleEmojiSelect}
                              theme="light"
                              locale={isEnglish ? "en" : "fr"}
                              previewPosition="none"
                              skinTonePosition="search"
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-[12px] text-[#8A929C] mt-1 text-right">{editBio.length}/500</div>
                    </div>

                    {/* Banner colors */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2">
                        {isEnglish ? "Banner colors" : "Couleurs de la bannière"}
                      </label>
                      <div
                        className="w-full h-16 rounded-lg mt-2"
                        style={{ background: `linear-gradient(to right, ${editColor1}, ${editColor2})` }}
                      />
                      <div className="flex gap-4 mt-3">
                        {/* Color 1 */}
                        <div className="flex-1">
                          <label className="text-[13px] text-[#6B737D] mb-1 block">
                            {isEnglish ? "Color 1" : "Couleur 1"}
                          </label>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded cursor-pointer flex-shrink-0 border border-[#D5DAE0]"
                              style={{ background: editColor1 }}
                              onClick={() => document.getElementById("color1-picker")?.click()}
                            />
                            <input
                              id="color1-picker"
                              type="color"
                              value={editColor1}
                              onChange={(e) => setEditColor1(e.target.value)}
                              className="hidden"
                            />
                            <input
                              type="text"
                              value={editColor1}
                              onChange={(e) => setEditColor1(e.target.value)}
                              maxLength={7}
                              className="flex-1 h-10 px-3 rounded border border-[#D5DAE0] font-mono text-[14px] outline-none focus:border-[#0066CC]"
                            />
                          </div>
                        </div>
                        {/* Color 2 */}
                        <div className="flex-1">
                          <label className="text-[13px] text-[#6B737D] mb-1 block">
                            {isEnglish ? "Color 2" : "Couleur 2"}
                          </label>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded cursor-pointer flex-shrink-0 border border-[#D5DAE0]"
                              style={{ background: editColor2 }}
                              onClick={() => document.getElementById("color2-picker")?.click()}
                            />
                            <input
                              id="color2-picker"
                              type="color"
                              value={editColor2}
                              onChange={(e) => setEditColor2(e.target.value)}
                              className="hidden"
                            />
                            <input
                              type="text"
                              value={editColor2}
                              onChange={(e) => setEditColor2(e.target.value)}
                              maxLength={7}
                              className="flex-1 h-10 px-3 rounded border border-[#D5DAE0] font-mono text-[14px] outline-none focus:border-[#0066CC]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Profile picture */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2">
                        {isEnglish ? "Profile picture" : "Photo de profil"}
                      </label>
                      <div className="flex items-center gap-4 mt-2">
                        <div
                          className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                          style={{ background: !avatarUrl ? avatarBg : undefined }}
                        >
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xl font-bold uppercase">
                              {user.username.slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => photoInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 h-10 px-4 rounded border border-[#D5DAE0] bg-white text-[14px] hover:bg-[#F5F7FA] disabled:opacity-60 transition-colors"
                          >
                            <ImageIcon className="w-4 h-4" />
                            {uploading ? "Upload..." : isEnglish ? "Photo" : "Photo"}
                          </button>
                          <span className="text-[12px] text-[#8A929C]">
                            {isEnglish ? "JPG, PNG or WebP · max 10 MB" : "JPG, PNG ou WebP · max 10 Mo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />

                    {/* Save */}
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="w-full h-12 rounded-lg bg-[#0066CC] text-white text-[15px] font-medium hover:bg-[#0055AA] disabled:opacity-60 transition-colors"
                    >
                      {saving
                        ? isEnglish ? "Saving..." : "Enregistrement..."
                        : isEnglish ? "Save changes" : "Enregistrer les modifications"}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {/* ── Appearance tab ── */}
            {section === "appearance" && (
              <div className="space-y-8">

                {/* Theme */}
                <section>
                  <div className="flex items-center gap-2 text-[18px] font-semibold text-[#003D82] mb-4">
                    <Palette className="w-5 h-5" />
                    <h2>{isEnglish ? "Theme" : "Thème"}</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {THEME_OPTIONS.map((opt) => {
                      const active = theme === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleSetTheme(opt.value)}
                          className={`relative rounded-lg overflow-hidden cursor-pointer text-left transition-colors ${
                            active
                              ? "border-2 border-[#0066CC]"
                              : "border border-[#D5DAE0] hover:border-[#0066CC]"
                          }`}
                        >
                          <div className={`h-16 ${opt.preview}`} />
                          {active && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0066CC] flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                          <div className="p-3">
                            <div className="flex items-center gap-2">
                              <span className={active ? "text-[#0066CC]" : "text-[#8A929C]"}>
                                {opt.icon}
                              </span>
                              <span className="text-[14px] font-medium text-[#333333]">{opt.label}</span>
                            </div>
                            <p className="text-[12px] text-[#8A929C] mt-0.5">{opt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Font size */}
                <section>
                  <div className="flex items-center gap-2 text-[18px] font-semibold text-[#003D82] mb-4">
                    <Type className="w-5 h-5" />
                    <h2>{isEnglish ? "Font size" : "Taille de la police"}</h2>
                  </div>
                  <div className="flex flex-col border border-[#D5DAE0] rounded-lg overflow-hidden">
                    {FONT_SIZE_OPTIONS.map((opt, i) => {
                      const active = fontSize === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setFontSize(opt.value)}
                          className={`h-12 flex items-center px-4 cursor-pointer transition-colors ${
                            i > 0 ? "border-t border-[#D5DAE0]" : ""
                          } ${
                            active
                              ? "bg-[#E6F0FB] border-l-2 border-l-[#0066CC]"
                              : "hover:bg-[#FAFBFC]"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                active ? "border-[#0066CC]" : "border-[#D5DAE0]"
                              }`}
                            >
                              {active && <div className="w-2 h-2 rounded-full bg-[#0066CC]" />}
                            </div>
                            <span className={`text-[14px] ${active ? "font-medium text-[#0066CC]" : "text-[#333333]"}`}>
                              {opt.label}
                            </span>
                          </div>
                          <span className={`ml-auto font-mono ${opt.aaSize} ${active ? "text-[#0066CC]" : "text-[#8A929C]"}`}>
                            Aa
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[12px] text-[#8A929C]">
                    {isEnglish
                      ? "Font size applies to messages and server content."
                      : "La taille de police s'applique aux messages et au contenu du serveur."}
                  </p>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
