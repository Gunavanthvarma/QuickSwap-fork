import { useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { SigninRedirectState } from "./signinRedirect";

/** Navigate to `/signin` preserving current location as `state.from` for post-login return. */
export function useSignInRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    const state: SigninRedirectState = {
      from: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
    };
    navigate("/signin", { replace: true, state });
  }, [navigate, location.pathname, location.search, location.hash]);
}
