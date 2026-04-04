import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import type { SigninRedirectState } from "./signinRedirect";

type ProtectedRouteProps = {
  children: ReactElement;
};

/**
 * Requires `isAuthenticated`. Sends guests to `/signin` with `state.from` so Signin can return them here.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const state: SigninRedirectState = {
      from: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
    };
    return <Navigate to="/signin" replace state={state} />;
  }

  return children;
}
