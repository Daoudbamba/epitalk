//les règles de connexion tout ce qui concerne login, logout

import { FetchClient } from "./fetchClient";
import { LoginSchema, type LoginInput, UserSchema, type User } from "./schemas/auth.schema";

export class AuthAPI {
  private client: FetchClient;

  constructor(client: FetchClient) {
    this.client = client;
  }

  async login(data: LoginInput): Promise<void> {
    // Vérifie les données AVANT d’envoyer au backend
    const validData = LoginSchema.parse(data);

    await this.client.post("/auth/login", validData);
  }

  async me(): Promise<User> {
    const response = await this.client.get<User>("/api/auth/me");
    return UserSchema.parse(response);
  }

  async logout(): Promise<void> {
    await this.client.post("/auth/logout");
  }
}
