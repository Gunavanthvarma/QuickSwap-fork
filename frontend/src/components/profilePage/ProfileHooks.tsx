import { useState, useEffect, useCallback } from "react";
import { notifyAuthSessionExpired, readUserFromStorage } from "../../auth/auth-context";
import { useSignInRedirect } from "../../auth/useSignInRedirect";
import { apiErrorMessage, authHeaders, getApiUrl, isFetchAborted, isRecord } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import {
  formatTimeRemainingFromBackendString,
  formatTimeRemainingFromEnd,
} from "../../utils/formatTimeRemaining";
import type {
  ProfileResponse,
  EditFormState,
  UpdatePasswordFormState,
  ListingCardItem,
  BidCardItem,
  MyListingApiItem,
  MyBidsApiItem,
  MyListingsApiResponse,
  MyBidsApiResponse,
} from "./Profile.types";

/** Maps Supabase/Postgres delete errors to copy users can act on (backend returns raw JSON in `error`). */
export function formatDeleteAccountApiError(raw: string): string {
  const fallback = "Could not delete account. Please try again or contact support.";
  const t = raw.trim();
  if (!t) return fallback;

  const lower = t.toLowerCase();
  const mentionsFk =
    t.includes("23503") ||
    lower.includes("foreign key constraint") ||
    lower.includes("violates foreign key");

  let detail = "";
  const jsonPayload = t.replace(/^Failed to delete account:\s*/i, "").trim();
  if (jsonPayload.startsWith("{")) {
    try {
      const o = JSON.parse(jsonPayload) as { code?: string; message?: string; detail?: string };
      if (o.code === "23503") {
        detail = `${o.message ?? ""} ${o.detail ?? ""}`.toLowerCase();
      }
    } catch {
      /* ignore */
    }
  }

  if (mentionsFk || detail.includes("foreign") || detail.includes("referenced")) {
    if (detail.includes("bids") || lower.includes("bids_user_id")) {
      return "Your account can’t be deleted while bid history is still linked to it. The app can’t remove those records—please contact support to close your account.";
    }
    return "Your account can’t be deleted while some of your activity is still linked in our system (for example bids or listings). Please contact support to close your account.";
  }

  return t.length > 320 ? fallback : t;
}

export type ProfileFetchOptions = {
  signal?: AbortSignal;
};

const TIMEOUT_MS = 10000;

function createAbortSignal(): [AbortSignal, ReturnType<typeof setTimeout>] {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return [controller.signal, timeoutId];
}

function mergeProfileFromApi(base: ProfileResponse, row: Record<string, unknown>): ProfileResponse {
  const out: ProfileResponse = { ...base };
  const pickStr = (k: string): string | undefined =>
    typeof row[k] === "string" ? (row[k] as string) : undefined;
  const first = pickStr("first_name");
  const last = pickStr("last_name");
  const mobile = pickStr("mobile");
  const email = pickStr("email");
  if (first !== undefined) out.first_name = first;
  if (last !== undefined) out.last_name = last;
  if (mobile !== undefined) out.mobile = mobile;
  if (email !== undefined) out.email = email;
  const created = pickStr("created_at");
  if (created !== undefined) out.created_at = created;
  const location = pickStr("location");
  if (location !== undefined) out.location = location;
  return out;
}

// ─── useProfile ───────────────────────────────────────────────────────────────

export const useProfile = () => {
  const [user, setUser] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    first_name: "",
    last_name: "",
    mobile: "",
  });
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  /** Bumps when opening the edit modal so the modal remounts with fresh local state. */
  const [profileEditModalKey, setProfileEditModalKey] = useState(0);

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState<UpdatePasswordFormState>({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordModalKey, setPasswordModalKey] = useState(0);

  const [deleteAccountFlow, setDeleteAccountFlow] = useState<"closed" | "phrase" | "final">("closed");
  const [deletePhraseInput, setDeletePhraseInput] = useState("");
  const [deletePhraseError, setDeletePhraseError] = useState<string | null>(null);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountModalKey, setDeleteAccountModalKey] = useState(0);

  const redirectToSignin = useSignInRedirect();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          redirectToSignin();
          return;
        }

        const parsed = readUserFromStorage();
        if (!parsed) {
          redirectToSignin();
          return;
        }

        if (!cancelled) setUser(parsed);

        const [signal, timeoutId] = createAbortSignal();
        try {
          const res = await fetch(getApiUrl("/api/profile"), {
            method: "GET",
            headers: authHeaders(token),
            signal,
          });
          clearTimeout(timeoutId);

          if (res.status === 401) {
            notifyAuthSessionExpired();
            redirectToSignin();
            return;
          }

          if (!cancelled && res.ok) {
            const row: unknown = await res.json().catch(() => null);
            if (row && typeof row === "object" && !Array.isArray(row)) {
              const merged = mergeProfileFromApi(parsed, row as Record<string, unknown>);
              setUser(merged);
              localStorage.setItem("user", JSON.stringify(merged));
            }
          }
        } catch (err) {
          clearTimeout(timeoutId);
          if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
          throw err;
        }
      } catch (err: unknown) {
        console.error("Failed to load profile:", err);
        if (!cancelled) setError("Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [redirectToSignin]);

  const handleEditOpen = () => {
    if (user) {
      setProfileSaveError(null);
      setProfileEditModalKey((k) => k + 1);
      setEditForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        mobile: user.mobile || "",
      });
      setIsEditingProfile(true);
    }
  };

  const handlePasswordOpen = () => {
    setPasswordUpdateError(null);
    setPasswordModalKey((k) => k + 1);
    setPasswordForm({
      old_password: "",
      new_password: "",
      confirm_password: "",
    });
    setIsUpdatingPassword(true);
  };

  const handleDeleteAccountOpen = () => {
    setDeletePhraseError(null);
    setDeleteAccountError(null);
    setDeletingAccount(false);
    setDeletePhraseInput("");
    setDeleteAccountModalKey((k) => k + 1);
    setDeleteAccountFlow("phrase");
  };

  const closeDeleteAccountFlow = () => {
    setDeleteAccountFlow("closed");
    setDeletePhraseInput("");
    setDeletePhraseError(null);
    setDeleteAccountError(null);
    setDeletingAccount(false);
  };

  const tryAdvanceToFinalDeleteStep = () => {
    setDeletePhraseError(null);
    if (deletePhraseInput.trim() !== "Delete") {
      setDeletePhraseError("Please type Delete exactly to confirm.");
      return;
    }
    setDeleteAccountFlow("final");
  };

  const confirmDeleteAccount = async () => {
    setDeleteAccountError(null);
    const token = localStorage.getItem("accessToken");
    if (!token) {
      redirectToSignin();
      return;
    }

    setDeletingAccount(true);
    const [signal, timeoutId] = createAbortSignal();

    try {
      const response = await fetch(getApiUrl("/api/profile/account"), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      const apiError =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "";

      if (!response.ok) {
        if (response.status === 401) {
          closeDeleteAccountFlow();
          notifyAuthSessionExpired();
          redirectToSignin();
          return;
        }
        setDeleteAccountError(
          apiError ? formatDeleteAccountApiError(apiError) : "Could not delete account. Please try again.",
        );
        return;
      }

      closeDeleteAccountFlow();
      redirectToSignin();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setDeleteAccountError("Request timed out. Please check your connection and try again.");
      } else {
        console.error("[API] /api/profile/account error:", err);
        setDeleteAccountError(
          err instanceof Error ? err.message : "Could not delete account. Please try again.",
        );
      }
    } finally {
      clearTimeout(timeoutId);
      setDeletingAccount(false);
    }
  };

  const handlePasswordSubmit = async (_e: React.FormEvent): Promise<boolean> => {
    setPasswordUpdateError(null);
    const oldPw = passwordForm.old_password.trim();
    const newPw = passwordForm.new_password.trim();
    const confirmPw = passwordForm.confirm_password.trim();

    if (!oldPw || !newPw || !confirmPw) {
      setPasswordUpdateError("Please fill in all fields.");
      return false;
    }
    if (newPw !== confirmPw) {
      setPasswordUpdateError("New passwords do not match.");
      return false;
    }
    if (newPw.length < 6) {
      setPasswordUpdateError("New password must be at least 6 characters.");
      return false;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      redirectToSignin();
      return false;
    }

    setSavingPassword(true);
    const [signal, timeoutId] = createAbortSignal();

    try {
      const response = await fetch(getApiUrl("/api/profile/password"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: oldPw,
          new_password: newPw,
          re_enter_new_password: confirmPw,
        }),
        signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      const apiError =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "";

      if (!response.ok) {
        // Same endpoint returns 401 for bad session and for wrong old password; only sign out on auth failure.
        if (response.status === 401) {
          const wrongOldPassword = apiError.toLowerCase().includes("old password");
          if (wrongOldPassword) {
            setPasswordUpdateError(apiError || "Incorrect old password");
            return false;
          }
          notifyAuthSessionExpired();
          redirectToSignin();
          return false;
        }
        setPasswordUpdateError(apiError || "Failed to update password");
        return false;
      }

      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setPasswordUpdateError("Request timed out. Please check your connection and try again.");
      } else {
        console.error("[API] /api/profile/password error:", err);
        setPasswordUpdateError(
          err instanceof Error ? err.message : "Failed to update password"
        );
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
      setSavingPassword(false);
    }
  };

  const handleEditSubmit = async (_e: React.FormEvent): Promise<boolean> => {
    if (!user) return false;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      redirectToSignin();
      return false;
    }

    const payload = {
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      mobile: editForm.mobile.trim(),
    };

    setProfileSaveError(null);
    setSavingProfile(true);
    const [signal, timeoutId] = createAbortSignal();

    try {
      const response = await fetch(getApiUrl("/api/profile/update"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          notifyAuthSessionExpired();
          redirectToSignin();
          return false;
        }
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Failed to update profile";
        setProfileSaveError(msg);
        return false;
      }

      const updatedUser: ProfileResponse = { ...user, ...payload };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setProfileSaveError("Request timed out. Please check your connection and try again.");
      } else {
        console.error("[API] /api/profile/update error:", err);
        setProfileSaveError(
          err instanceof Error ? err.message : "Failed to update profile"
        );
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
      setSavingProfile(false);
    }
  };

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email.split("@")[0] ?? "";

  return {
    user, loading, error, displayName,
    isEditingProfile, editForm, setEditForm,
    profileSaveError, savingProfile, profileEditModalKey,
    handleEditOpen, handleEditSubmit,
    closeEdit: () => {
      setProfileSaveError(null);
      setSavingProfile(false);
      setIsEditingProfile(false);
    },
    isUpdatingPassword,
    passwordForm,
    setPasswordForm,
    passwordUpdateError,
    passwordModalKey,
    handlePasswordOpen,
    handlePasswordSubmit,
    savingPassword,
    closePassword: () => {
      setPasswordUpdateError(null);
      setSavingPassword(false);
      setIsUpdatingPassword(false);
    },
    deleteAccountFlow,
    deletePhraseInput,
    setDeletePhraseInput,
    deletePhraseError,
    deleteAccountError,
    deletingAccount,
    deleteAccountModalKey,
    handleDeleteAccountOpen,
    closeDeleteAccountFlow,
    tryAdvanceToFinalDeleteStep,
    confirmDeleteAccount,
  };
};

// ─── useMyListings ────────────────────────────────────────────────────────────

export const useMyListings = () => {
  const [userListings, setUserListings] = useState<ListingCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectToSignin = useSignInRedirect();

  const fetchMyListings = useCallback(async (options?: ProfileFetchOptions) => {
    let externalSignal = options?.signal;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Create timeout signal if not provided
    const [signal, newTimeoutId] = createAbortSignal();
    if (!externalSignal) {
      externalSignal = signal;
      timeoutId = newTimeoutId;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      if (timeoutId) clearTimeout(timeoutId);
      redirectToSignin();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mylistings"), {
        method: "GET",
        headers: authHeaders(token),
        signal: externalSignal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const rawJson: unknown = await response.json().catch(() => ({}));
      if (response.status === 401) {
        notifyAuthSessionExpired();
        redirectToSignin();
        return;
      }

      // Handle "no listings found" as success with empty array
      if (response.status === 404) {
        const errorMsg = typeof rawJson === 'object' && rawJson !== null && 'error' in rawJson
          ? (rawJson as { error?: string }).error
          : '';
        if (errorMsg?.toLowerCase().includes('no listings')) {
          setUserListings([]);
          return;
        }
        throw new Error(errorMsg || "Listing not found");
      }

      if (!response.ok) {
        throw new Error(apiErrorMessage(rawJson, "Failed to fetch listings"));
      }

      const payload = rawJson as MyListingsApiResponse;
      const listings: ListingCardItem[] = Array.isArray(payload.listings)
        ? payload.listings.map((item: MyListingApiItem) => ({
            id: item.listing_id,
            name: item.title,
            image: item.image || "",
            currentBid: formatCurrency(item.current_bid),
            timeLeft: formatTimeRemainingFromBackendString(item.time_left || "Ended"),
            bids: item.total_bids || 0,
            status: item.status?.toLowerCase() === "active" ? "active" : "sold",
          }))
        : [];

      setUserListings(listings);
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      if (isFetchAborted(err) && !timeoutId) return;
      if (err instanceof Error && err.name === 'AbortError') {
        console.error("[API] /api/mylistings timeout:", err);
        setError("Request timed out. Please check your connection and try again.");
      } else {
        console.error("[API] /api/mylistings error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch listings");
      }
      setUserListings([]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [redirectToSignin]);

  return { userListings, loading, error, fetchMyListings };
};

// ─── useMyBids ────────────────────────────────────────────────────────────────

export const useMyBids = () => {
  const [userBids, setUserBids] = useState<BidCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectToSignin = useSignInRedirect();

  const fetchMyBids = useCallback(async (options?: ProfileFetchOptions) => {
    let externalSignal = options?.signal;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Create timeout signal if not provided
    const [signal, newTimeoutId] = createAbortSignal();
    if (!externalSignal) {
      externalSignal = signal;
      timeoutId = newTimeoutId;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      if (timeoutId) clearTimeout(timeoutId);
      redirectToSignin();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mybids"), {
        method: "GET",
        headers: authHeaders(token),
        signal: externalSignal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const rawJson: unknown = await response.json().catch(() => ({}));
      if (response.status === 401) {
        notifyAuthSessionExpired();
        redirectToSignin();
        return;
      }

      // Handle "no bids found" as success with empty array
      if (response.status === 404) {
        const errorMsg = typeof rawJson === 'object' && rawJson !== null && 'error' in rawJson
          ? (rawJson as { error?: string }).error
          : '';
        if (errorMsg?.toLowerCase().includes('no bids')) {
          setUserBids([]);
          return;
        }
        throw new Error(errorMsg || "Bids not found");
      }

      if (!response.ok) {
        throw new Error(apiErrorMessage(rawJson, "Failed to fetch bids"));
      }

      let raw: MyBidsApiItem[] = [];
      if (Array.isArray(rawJson)) {
        raw = rawJson as MyBidsApiItem[];
      } else if (isRecord(rawJson) && Array.isArray(rawJson.bids)) {
        raw = (rawJson as MyBidsApiResponse).bids ?? [];
      }

      const bids: BidCardItem[] = raw.map((item) => {
        const normalized = item.label?.toLowerCase();
        const status: BidCardItem["status"] =
          normalized === "winning" || normalized === "outbid" || normalized === "lost"
            ? normalized : "outbid";

        return {
          id: item.id || item.listing_id,
          name: item.title || "Untitled listing",
          image: item.image || "",
          yourBid: formatCurrency(item.bid_amount),
          currentBid: formatCurrency(item.current_bid),
          timeLeft: item.auction_end_time
            ? formatTimeRemainingFromEnd(item.auction_end_time)
            : formatTimeRemainingFromBackendString(item.time_left || "Ended"),
          status,
        };
      });

      setUserBids(bids);
    } catch (err: unknown) {
      if (timeoutId) clearTimeout(timeoutId);
      if (isFetchAborted(err) && !timeoutId) return;
      if (err instanceof Error && err.name === 'AbortError') {
        console.error("[API] /api/mybids timeout:", err);
        setError("Request timed out. Please check your connection and try again.");
      } else {
        console.error("[API] /api/mybids error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch bids");
      }
      setUserBids([]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [redirectToSignin]);

  return { userBids, loading, error, fetchMyBids };
};