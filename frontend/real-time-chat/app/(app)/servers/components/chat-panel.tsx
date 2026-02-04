"use client";

import { Input } from "@/components/ui/input";
import { Plus, Smile, Gift, Sticker } from "lucide-react";

const MOCK_MESSAGES = [
  {
    id: 1,
    user: "Océane",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oceane",
    content: "Salut ! Quelqu'un peut m'aider avec le Docker ?",
    timestamp: "Aujourd'hui à 14:02",
    role: "admin",
  },
  {
    id: 2,
    user: "DevJunior",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    content: "Bien sûr ! T'as pensé à vérifier le docker-compose ?",
    timestamp: "Aujourd'hui à 14:05",
    role: "guest",
  },
];

export function ChatPanel() {
  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-[#313338]">
      {/* --- HEADER --- */}
      <div className="h-12 px-4 flex items-center border-b shadow-sm dark:border-zinc-800 shrink-0">
        <span className="text-zinc-500 mr-2 text-2xl">#</span>
        <h2 className="font-bold text-md text-zinc-800 dark:text-zinc-100">
          général
        </h2>
      </div>

      {/* --- MESSAGES --- */}
      <div className="flex-1 overflow-y-auto flex flex-col py-4">
        <div className="flex-1" />
        <div className="flex flex-col mt-auto">
          {MOCK_MESSAGES.map((msg) => (
            <div
              key={msg.id}
              className="group flex items-start p-4 hover:bg-black/5 dark:hover:bg-white/5 transition w-full"
            >
              <div className="cursor-pointer hover:drop-shadow-md transition mr-4">
                <img
                  src={msg.avatar}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full bg-zinc-200"
                />
              </div>
              <div className="flex flex-col w-full">
                <div className="flex items-center gap-x-2">
                  <span className="font-semibold text-sm hover:underline cursor-pointer text-zinc-800 dark:text-zinc-100">
                    {msg.user}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {msg.timestamp}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- INPUT --- */}
      <div className="p-4 mb-2 shrink-0">
        <div className="relative">
          <button
            type="button"
            className="absolute left-4 top-3 h-6 w-6 bg-zinc-500 dark:bg-zinc-400 hover:bg-zinc-600 transition rounded-full p-1 flex items-center justify-center text-white"
          >
            <Plus className="text-white dark:text-[#313338]" />
          </button>

          <Input
            className="px-14 py-6 bg-zinc-200/90 dark:bg-zinc-700/75 border-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200 placeholder:text-zinc-500"
            placeholder="Envoyer un message dans #général"
          />

          <div className="absolute right-4 top-3 flex items-center gap-x-4">
            <Gift className="text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer" />
            <Sticker className="text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer" />
            <Smile className="text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition cursor-pointer" />
          </div>
        </div>
      </div>
    </div>
  );
}
