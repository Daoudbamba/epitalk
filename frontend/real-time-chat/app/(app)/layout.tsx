"use client"

import type { ReactNode } from "react"
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    }
  }, [user, router]);

  return (
    <div className="h-screen w-screen flex">
      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>
    </div>
  );
}