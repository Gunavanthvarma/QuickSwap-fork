import { createContext } from "react";
import type { ProfileResponse } from "../components/profilePage/Profile.types";

export function readUserFromStorage(): ProfileResponse | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("email" in parsed) ||
      typeof (parsed as { email?: unknown }).email !== "string"
    ) {
      return null;
    }
    return parsed as ProfileResponse;
  } catch {
    return null;
  }
}

export type AuthContextValue = {
  user: ProfileResponse | null;
  isAuthenticated: boolean;
  refreshUser: () => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
