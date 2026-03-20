"use client";

import { useEffect } from "react";
import { useAppearanceStore } from "@/store/appearance.store";

const FONT_SIZE_MAP = { sm: "14px", base: "16px", lg: "18px", xl: "20px" } as const;

export function ThemeInitializer() {
  const theme = useAppearanceStore((s) => s.theme);
  const fontSize = useAppearanceStore((s) => s.fontSize);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "ash", "dim", "dark");
    if (theme !== "light") {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--chat-font-size", FONT_SIZE_MAP[fontSize]);
  }, [fontSize]);

  return null;
}
