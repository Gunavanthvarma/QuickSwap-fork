import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AuthContext,
  AUTH_SESSION_EXPIRED_EVENT,
  readUserFromStorage,
  type AuthContextValue,
} from "./auth-context";
import { topListingsQueryKey } from "../components/landingPage/topListingsQuery";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(() => readUserFromStorage());

  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
      queryClient.removeQueries({ queryKey: topListingsQueryKey });
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [queryClient]);

  const refreshUser = useCallback(() => {
    setUser(readUserFromStorage());
  }, []);

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
