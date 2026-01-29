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
      <aside className="w-16 bg-muted border-r flex items-center justify-center">
        Servers
      </aside>

      <aside className="w-60 bg-background border-r flex items-center justify-center">
        Channels
      </aside>

      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>
    </div>
  );
}