import type { MembershipRoleEnum } from "@/enums";

export interface LoginInput {
  email: string;
  senha: string;
}

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
}

export interface AuthOrganization {
  id: string;
  nome: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
  organization: AuthOrganization;
  role: MembershipRoleEnum;
}

export interface AuthSession extends AuthResponse {
  expiresAt: number;
}
