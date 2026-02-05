import { FetchClient } from "./fetchClient";
import {
  LoginSchema,
  type LoginInput,
  RegisterSchema,
  type RegisterInput,
  UserSchema,
  type User,
  AuthResponseSchema,
  type AuthResponse,
} from "./schemas/auth.schema";

export class AuthAPI {
  private client: FetchClient;

  constructor(client: FetchClient) {
    this.client = client;
  }

  async register(data: RegisterInput): Promise<AuthResponse> {
    const validData = RegisterSchema.parse(data);
    const response = await this.client.post<AuthResponse>("/auth/register", validData);
    return AuthResponseSchema.parse(response);
  }

  async login(data: LoginInput): Promise<AuthResponse> {
    const validData = LoginSchema.parse(data);
    const response = await this.client.post<AuthResponse>("/auth/login", validData);
    return AuthResponseSchema.parse(response);
  }

  async me(): Promise<User> {
    const response = await this.client.get<User>("/auth/me");
    return UserSchema.parse(response);
  }

  async refresh(): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>("/auth/refresh");
    return AuthResponseSchema.parse(response);
  }

  async logout(): Promise<void> {
    // Logout cote client - supprimer le token du localStorage
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
  }
}
