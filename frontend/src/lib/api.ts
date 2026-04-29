/**
 * Builds an absolute API URL from VITE_API_BASE and a path.
 * When VITE_API_BASE is empty, returns `path` (relative, for Vite proxy).
 */
export function getApiUrl(path: string): string {
  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "";
  let apiBase = rawApiBase.replace(/["']+/g, "").trim();
  
  if (!apiBase && import.meta.env.DEV) {
    apiBase = "http://localhost:8082";
  } else if (!apiBase) {
    return path;
  }

  const normalizedBase = apiBase.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/** Absolute URL for `EventSource` (SSE); same rules as `getApiUrl`. */
export function getSSEUrl(path: string): string {
  const u = getApiUrl(path);
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${u.startsWith("/") ? u : `/${u}`}`;
  }
  return u;
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when `fetch` (or a reader) was aborted via `AbortController`. */
export function isFetchAborted(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  return err instanceof Error && err.name === "AbortError";
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const p = payload as ApiErrorPayload;
    if (typeof p.error === "string" && p.error) return p.error;
    if (typeof p.message === "string" && p.message) return p.message;
  }
  return fallback;
}
