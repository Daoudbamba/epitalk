"use client";

import { AtSign, X, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

interface MentionToastProps {
  serverName?: string;
  channelName?: string;
  username?: string;
  message: string;
  onDismiss?: () => void;
  onView?: () => void;
}

export function MentionToast({
  serverName = "EpiTalk",
  channelName,
  username,
  message,
  onDismiss,
  onView,
}: MentionToastProps) {
  const initials = username ? username.slice(0, 2).toUpperCase() : "??";
  const isGif = message === "🖼 GIF";
  const cleanMessage =
    username && message.startsWith(`${username}: `)
      ? message.slice(username.length + 2)
      : message;

  const [barWidth, setBarWidth] = useState(100);
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(0), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative w-[360px] bg-white rounded-lg overflow-hidden border border-[#D5DAE0] shadow-[0_4px_16px_rgba(15,24,40,0.10)]">
      {/* Left accent bar — orange for mention */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF6B35]" />

      {/* Header */}
      <div className="flex items-center justify-between pl-4 pr-4 pt-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFF0EB] text-[#FF6B35]">
            <AtSign size={11} />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wide">Mention</span>
          </div>
          <span className="text-[11px] font-mono text-[#8A929C]">
            {channelName ? `${serverName} · #${channelName}` : serverName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#8A929C]">à l&apos;instant</span>
          <button
            onClick={onDismiss}
            className="w-5 h-5 rounded flex items-center justify-center text-[#B8BFC7] hover:text-[#8A929C] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="pl-4 pr-4 py-3">
        {username && (
          <div className="flex items-center gap-2 mb-2">
            <div className="relative w-8 h-8 rounded-full bg-[#FF6B35] flex items-center justify-center shrink-0">
              <span className="text-white font-mono text-[11px] font-semibold">{initials}</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-white" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#003D82]">{username}</span>
              <span className="text-[11px] font-mono text-[#8A929C]">à l&apos;instant</span>
            </div>
          </div>
        )}

        {/* Message content */}
        <div className="mt-1">
          {isGif ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ECEEF1] text-[#6B737D] text-[10px] font-mono font-semibold">
              GIF
            </span>
          ) : (
            <p className="text-[13px] text-[#333333] leading-[18px] line-clamp-2">
              {cleanMessage}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pl-4 pr-4 pb-3">
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 rounded text-[12px] font-medium text-[#8A929C] hover:text-[#333333] hover:bg-[#ECEEF1] transition-colors"
        >
          Ignorer
        </button>
        <button
          onClick={onView}
          className="px-4 py-1.5 rounded text-[12px] font-medium flex items-center gap-1.5 bg-[#FF6B35] text-white hover:bg-[#E55A26] transition-colors"
        >
          Voir le message
          <ArrowRight size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5">
        <div
          className="h-full bg-[#FF6B35]"
          style={{ width: `${barWidth}%`, transition: "width 6s linear" }}
        />
      </div>
    </div>
  );
}
