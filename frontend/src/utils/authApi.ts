/**
 * Shared helpers for QuickSwap auth API routes (same base URL rules as profile hooks).
 */

export function getApiUrl(path: string): string {
  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "";
  const apiBase = rawApiBase.replace(/["']+/g, "").trim();
  if (!apiBase) return path;

  const normalizedBase = apiBase.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function clearLocalAuth(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("accessTokenExpiry");
  localStorage.removeItem("user");
}

export interface AuthMeResponse {
  id: string;
  email: string;
}

/** GET /api/auth/me — validates the access token and returns id + email. */
export async function fetchAuthMe(token: string): Promise<AuthMeResponse> {
  const response = await fetch(getApiUrl("/api/auth/me"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    email?: string;
  };
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Not authenticated"
    );
  }
  if (!data.id || !data.email) {
    throw new Error("Invalid response from auth server");
  }
  return { id: data.id, email: data.email };
}

/** POST /api/auth/logout — revokes the session server-side (best-effort). */
export async function postAuthLogout(token: string): Promise<void> {
  try {
    await fetch(getApiUrl("/api/auth/logout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // Network errors: still clear storage in the caller.
  }
}
