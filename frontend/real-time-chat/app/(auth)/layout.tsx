"use client"

import type { ReactNode } from "react"
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/servers");
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}
