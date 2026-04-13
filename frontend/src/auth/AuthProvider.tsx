import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AuthContext,
  AUTH_SESSION_EXPIRED_EVENT,
  getValidUserFromStorage,
  type AuthContextValue,
} from "./auth-context";
import { topListingsQueryKey } from "../components/landingPage/topListingsQuery";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(() => getValidUserFromStorage());

  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
      queryClient.removeQueries({ queryKey: topListingsQueryKey });
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [queryClient]);

  const reconcileSession = useCallback(() => {
    setUser((prev) => {
      const next = getValidUserFromStorage();
      if (prev !== null && next === null) {
        queryClient.removeQueries({ queryKey: topListingsQueryKey });
      }
      return next;
    });
  }, [queryClient]);

  /** Re-sync when routes change so protected pages never trust a stale cached user. */
  useEffect(() => {
    reconcileSession();
  }, [location.pathname, location.search, location.hash, reconcileSession]);

  /** Expire mid-session (e.g. tab left open past access token lifetime). */
  useEffect(() => {
    const id = window.setInterval(() => reconcileSession(), 60_000);
    const onFocus = () => reconcileSession();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [reconcileSession]);

  const refreshUser = useCallback(() => {
    reconcileSession();
  }, [reconcileSession]);

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accessTokenExpiry");
    localStorage.removeItem("user");
    queryClient.removeQueries({ queryKey: topListingsQueryKey });
    setUser(null);
    navigate("/", { replace: true });
  }, [navigate, queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      refreshUser,
      logout,
    }),
    [user, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
