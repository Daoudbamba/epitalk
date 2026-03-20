"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      if (!token) {
        if (!cancelled) setIsChecking(false);
        return;
      }

      try {
        await authApi.me();
        if (!cancelled) {
          router.replace("/servers");
        }
      } catch {
        if (!cancelled) setIsChecking(false);
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
        Verification de session...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}
