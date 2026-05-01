"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/lib/api";
import { useState } from "react";
import { getErrorMessage } from "@/lib/api/errors";
import { useLanguage } from "@/components/language-provider";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft } from "lucide-react";

export function LoginForm() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const router = useRouter();
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

    if (!email.trim() || !password.trim()) {
      setError(
        isEnglish ? "Please fill in all fields." : "Veuillez remplir tous les champs.",
      );
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      setAuth(response);
      router.push("/servers");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#D5DAE0] shadow-[0_1px_2px_rgba(15,24,40,0.04),0_1px_3px_rgba(15,24,40,0.03)] w-full max-w-md p-8 font-['IBM_Plex_Sans']">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 rounded-full bg-[#E6F0FB] text-[#0066CC] text-[11px] font-mono font-semibold uppercase tracking-[0.06em]">
            Compte EpiTalk
          </span>
          <span className="text-[#D5DAE0] text-[13px]">·</span>
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[#8A929C]">
            EPITECH SSO COMPATIBLE
          </span>
        </div>
        <h1 className="text-[24px] font-semibold text-[#003D82] mb-2">
          {isEnglish ? "Sign in to your account" : "Connectez-vous à votre compte"}
        </h1>
        <p className="text-[14px] text-[#6B737D] leading-[20px]">
          {isEnglish
            ? "Enter your EPITECH credentials to access your servers and messages."
            : "Entrez vos identifiants EPITECH pour accéder à vos serveurs et messages."}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Error */}
        {error && (
          <div className="text-red-500 text-sm text-center p-2 bg-red-50 rounded mb-4">
            {error}
          </div>
        )}

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
              placeholder="julien.nguyen@epitech.eu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 bg-transparent outline-none text-[14px] text-[#333333] placeholder:text-[#B8BFC7]"
            />
          </div>
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
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
          disabled={loading || !email.trim() || !password.trim()}
          className="w-full h-12 rounded-lg mb-4 bg-[#0066CC] text-white text-[15px] font-medium hover:bg-[#0055AA] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? (isEnglish ? "Signing in…" : "Connexion…")
            : (<><span>{isEnglish ? "Sign in" : "Se connecter"}</span><ArrowRight size={16} /></>)}
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
        {isEnglish ? "Don't have an account? " : "Pas encore de compte ? "}
        <span
          onClick={() => router.push("/register")}
          className="text-[#0066CC] font-medium cursor-pointer hover:underline"
        >
          {isEnglish ? "Sign up" : "S’inscrire"}
        </span>
      </p>
    </div>
  );
}
