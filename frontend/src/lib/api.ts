/**
 * Builds an absolute API URL from VITE_API_BASE and a path.
 * When VITE_API_BASE is empty, returns `path` (relative, for Vite proxy).
 */
export function getApiUrl(path: string): string {
  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "";
  const apiBase = rawApiBase.replace(/["']+/g, "").trim();
  if (!apiBase) return path;

  const normalizedBase = apiBase.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/** JSON request headers; adds Bearer token when provided. */
export function authHeaders(accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export interface ApiErrorPayload {
  error?: string;
  message?: string;
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const p = payload as ApiErrorPayload;
    if (typeof p.error === "string" && p.error) return p.error;
    if (typeof p.message === "string" && p.message) return p.message;
  }
  return fallback;
}
