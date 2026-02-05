import { z } from "zod";import { z } from "zod";



// Ce que l'utilisateur ENVOIE pour se connecter// Ce que l'utilisateur ENVOIE pour se connecter

export const LoginSchema = z.object({export const LoginSchema = z.object({

  email: z.string().email(),  email: z.string().email(),

  password: z.string().min(1),  password: z.string().min(1),

});});



export type LoginInput = z.infer<typeof LoginSchema>;export type LoginInput = z.infer<typeof LoginSchema>;



// Ce que l'utilisateur ENVOIE pour s'inscrire// Ce que l'utilisateur ENVOIE pour s'inscrire

export const RegisterSchema = z.object({export const RegisterSchema = z.object({

  email: z.string().email(),  email: z.string().email(),

  username: z.string().min(3).max(32),  username: z.string().min(3).max(32),

  password: z.string().min(8),  password: z.string().min(8),

});});



export type RegisterInput = z.infer<typeof RegisterSchema>;export type RegisterInput = z.infer<typeof RegisterSchema>;



// Ce que le backend RENVOIE pour l'utilisateur// Ce que le backend RENVOIE pour l'utilisateur

export const UserSchema = z.object({export const UserSchema = z.object({

  id: z.string(),  id: z.string(),

  username: z.string(),  username: z.string(),

  email: z.string(),  email: z.string(),

  created_at: z.string().optional(),  created_at: z.string().optional(),

});});



export type User = z.infer<typeof UserSchema>;export type User = z.infer<typeof UserSchema>;



// Ce que le backend RENVOIE après login/register// Ce que le backend RENVOIE après login/register

export const AuthResponseSchema = z.object({export const AuthResponseSchema = z.object({

  token: z.string(),  token: z.string(),

  token_type: z.string(),  token_type: z.string(),

  expires_in: z.number(),  expires_in: z.number(),

  user: UserSchema,  user: UserSchema,

});});



export type AuthResponse = z.infer<typeof AuthResponseSchema>;export type AuthResponse = z.infer<typeof AuthResponseSchema>;

zod";

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
