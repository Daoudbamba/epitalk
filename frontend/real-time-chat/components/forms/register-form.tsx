"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/api";
import { useState } from "react";
import { getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft, Check } from "lucide-react";

function isValidUsername(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 24 &&
    /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(value)
  );
}

export function RegisterForm() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { language } = useLanguage();
  const isEnglish = language === "en";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation côté client
    if (username.trim().length < 3) {
      setError(
        isEnglish
          ? "Username must be at least 3 characters long."
          : "Le nom d'utilisateur doit contenir au moins 3 caractères.",
      );
      return;
    }
    if (password.length < 8) {
      setError(
        isEnglish
          ? "Password must be at least 8 characters long."
          : "Le mot de passe doit contenir au moins 8 caractères.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({ email, username, password });
      setAuth(response);
      router.push("/servers");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const usernameValid = isValidUsername(username);
  const isDisabled = loading || !username.trim() || !email.trim() || !password.trim();

  return (
    <div className="bg-white rounded-xl border border-[#D5DAE0] shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)] w-full max-w-md p-8 font-['IBM_Plex_Sans']">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full bg-[#E6F0FB] text-[#0066CC] text-[11px] font-mono font-semibold uppercase tracking-[0.06em]">
            {isEnglish ? "Registration" : "Inscription"}
          </span>
          <span className="text-[#D5DAE0] text-[13px]">·</span>
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
            {isEnglish ? "For Epitech students only" : "Réservé aux étudiants Epitech"}
          </span>
        </div>
        <h1 className="text-[24px] font-semibold text-[#003D82] mb-2">
          {isEnglish ? "Create your account" : "Créez votre compte"}
        </h1>
        <p className="text-[14px] text-[#6B737D] leading-5">
          {isEnglish
            ? "Enter your information to join EpiTalk. You can then join your promotion's servers."
            : "Renseignez vos informations pour rejoindre EpiTalk. Vous pourrez ensuite rejoindre les serveurs de votre promotion."}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Error */}
        {error && (
          <div className="text-red-500 text-sm text-center p-2 bg-red-50 rounded mb-4">
            {error}
          </div>
        )}

        {/* Username */}
        <div className="mb-4">
          <label htmlFor="username" className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2 block">
            {isEnglish ? "Username" : "Nom d'utilisateur"}
          </label>
          <div className={`flex items-center gap-3 h-12 px-4 rounded-lg border transition-all focus-within:border-[#0066CC] focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] ${usernameValid ? "border-[#2BAE5C]" : "border-[#D5DAE0]"}`}>
            <User size={16} className="text-[#8A929C] shrink-0" />
            <input
              id="username"
              type="text"
              placeholder="julien.nguyen"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={32}
              className="flex-1 bg-transparent outline-none text-[14px] text-[#333333] placeholder:text-[#B8BFC7]"
            />
            {usernameValid && <Check size={16} className="text-[#2BAE5C] shrink-0" />}
          </div>
          <p className="mt-1.5 text-[12px] text-[#8A929C]">
            {isEnglish
              ? "Visible to other members · 3 to 24 characters, kebab-case or dot."
              : "Visible par les autres membres · 3 à 24 caractères, kebab-case ou point."}
          </p>
        </div>

        {/* Email */}
        <div className="mb-4">
          <label htmlFor="email" className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2 block">
            {isEnglish ? "Epitech email" : "Email Epitech"}
          </label>
          <div className="flex items-center gap-3 h-12 px-4 rounded-lg border border-[#D5DAE0] focus-within:border-[#0066CC] focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] transition-all">
            <Mail size={16} className="text-[#8A929C] shrink-0" />
            <input
              id="email"
              type="email"
              placeholder="prenom.nom@epitech.eu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 bg-transparent outline-none text-[14px] text-[#333333] placeholder:text-[#B8BFC7]"
            />
          </div>
          <p className="mt-1.5 text-[12px] text-[#8A929C]">
            {isEnglish ? "Must end with @epitech.eu" : "Doit se terminer par @epitech.eu"}
          </p>
        </div>

        {/* Password */}
        <div className="mb-6">
          <label htmlFor="password" className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C] mb-2 block">
            {isEnglish ? "Password" : "Mot de passe"}
          </label>
          <div className="flex items-center gap-3 h-12 px-4 rounded-lg border border-[#D5DAE0] focus-within:border-[#0066CC] focus-within:shadow-[0_0_0_3px_rgba(74,158,255,0.18)] transition-all">
            <Lock size={16} className="text-[#8A929C] shrink-0" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={isEnglish ? "At least 8 characters" : "Au moins 8 caractères"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="flex-1 bg-transparent outline-none text-[14px] text-[#333333] placeholder:text-[#B8BFC7]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[#8A929C] hover:text-[#333333] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isDisabled}
          className="w-full h-12 rounded-lg mb-4 bg-[#0066CC] text-white text-[15px] font-medium hover:bg-[#0055AA] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? (isEnglish ? "Creating…" : "Création…")
            : (<><span>{isEnglish ? "Create account" : "Créer mon compte"}</span><ArrowRight size={16} /></>)}
        </button>

        {/* Back */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full h-10 rounded-lg mb-6 border border-[#D5DAE0] bg-white text-[#6B737D] text-[13px] font-medium hover:bg-[#F5F7FA] hover:text-[#333333] flex items-center justify-center gap-2 transition-colors"
        >
          <ChevronLeft size={14} />
          {isEnglish ? "Back to home" : "Retour vers la page de garde"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-[13px] text-[#8A929C]">
        {isEnglish ? "Already have an account? " : "Vous avez déjà un compte ? "}
        <span
          onClick={() => router.push("/login")}
          className="text-[#0066CC] font-medium cursor-pointer hover:underline"
        >
          {isEnglish ? "Sign in" : "Se connecter"}
        </span>
      </p>
    </div>
  );
}
