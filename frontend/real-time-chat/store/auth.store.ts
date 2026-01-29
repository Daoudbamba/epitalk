import { create } from "zustand"

type User = {
  id: string
  email: string
}

type AuthState = {
  user: User | null
  login: (email: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  login: (email) =>
    set({
      user: {
        id: "1",
        email,
      },
    }),

  logout: () => set({ user: null }),
}))
