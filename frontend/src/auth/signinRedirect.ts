export type SigninRedirectState = {
  /** Where to send the user after a successful sign-in (set by ProtectedRoute or profile hooks). */
  from?: { pathname: string; search?: string; hash?: string };
  signupSuccessMessage?: string;
};

/** Build an in-app path for post-login navigation; blocks open redirects and auth pages. */
export function getSafeReturnPath(state: SigninRedirectState | null | undefined): string {
  const from = state?.from;
  const pathname = from?.pathname;
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/";
  }
  if (pathname === "/signin" || pathname === "/signup") {
    return "/";
  }
  const search = state?.from?.search ?? "";
  const hash = state?.from?.hash ?? "";
  return `${pathname}${search}${hash}`;
}
