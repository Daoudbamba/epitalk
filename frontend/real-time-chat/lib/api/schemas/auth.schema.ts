import { z } from "zod";

// Ce que l’utilisateur ENVOIE pour se connecter
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// Ce que le backend RENVOIE
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
});

export type User = z.infer<typeof UserSchema>;
