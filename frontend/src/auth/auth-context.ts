import { createContext } from "react";
import type { ProfileResponse } from "../components/profilePage/Profile.types";

/** Dispatched after local auth storage is cleared so AuthProvider can sync React state. */
export const AUTH_SESSION_EXPIRED_EVENT = "quickswap:auth-session-expired";

/** Clears tokens and cached user (same keys as logout). Does not navigate. */
export function clearAuthStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("accessTokenExpiry");
  localStorage.removeItem("user");
}

/** Call when the API rejects the session (e.g. 401); clears storage and notifies AuthProvider. */
export function notifyAuthSessionExpired(): void {
  clearAuthStorage();
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}

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
