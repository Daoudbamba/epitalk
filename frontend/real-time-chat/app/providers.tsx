"use client";

import React from "react";
import { LanguageProvider } from "@/components/language-provider";

export function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
