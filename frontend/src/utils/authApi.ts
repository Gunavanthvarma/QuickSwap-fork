/**
 * Shared helpers for QuickSwap auth API routes (same base URL rules as profile hooks).
 */

import { getApiUrl } from "../lib/api";

export { getApiUrl };

const TIMEOUT_MS = 10000;

function createAbortSignal(): [AbortSignal, ReturnType<typeof setTimeout>] {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return [controller.signal, timeoutId];
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
  const [signal, timeoutId] = createAbortSignal();
  try {
    const response = await fetch(getApiUrl("/api/auth/me"), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
    clearTimeout(timeoutId);

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
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  }
}

/** POST /api/auth/logout — revokes the session server-side (best-effort). */
export async function postAuthLogout(token: string): Promise<void> {
  const [signal, timeoutId] = createAbortSignal();
  try {
    await fetch(getApiUrl("/api/auth/logout"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
  } catch {
    // Network errors: still clear storage in the caller.
  } finally {
    clearTimeout(timeoutId);
  }
}
