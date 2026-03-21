"use client"

import Link from "next/link";
import { RegisterForm } from "@/components/forms/register-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-4 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Retour à l&apos;accueil
        </Link>
        <RegisterForm />
      </div>
    </div>
  );
}
