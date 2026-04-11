import { useState, useEffect } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
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
} from "./Profile.types";

// ─── Utils ────────────────────────────────────────────────────────────────────

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount || 0);

export const getApiUrl = (path: string): string => {
  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "";
  const apiBase = rawApiBase.replace(/["']+/g, "").trim();
  if (!apiBase) return path;
  
  const normalizedBase = apiBase.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

function clearAuthAndRedirectToSignIn(navigate: NavigateFunction) {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("accessTokenExpiry");
  localStorage.removeItem("user");
  navigate("/signin", { replace: true });
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
  const [deleteAccountModalKey, setDeleteAccountModalKey] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) { navigate("/signin"); return; }

      const expiryRaw = localStorage.getItem("accessTokenExpiry");
      if (expiryRaw) {
        const expiryMs = Number(expiryRaw);
        if (Number.isFinite(expiryMs) && Date.now() >= expiryMs) {
          clearAuthAndRedirectToSignIn(navigate);
          return;
        }
      }

      const userStr = localStorage.getItem("user");
      if (!userStr) { navigate("/signin"); return; }

      setUser(JSON.parse(userStr));
    } catch (err) {
      console.error("Failed to parse user from local storage:", err);
      setError("Failed to load profile");
      navigate("/signin");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

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
    setDeletePhraseInput("");
    setDeleteAccountModalKey((k) => k + 1);
    setDeleteAccountFlow("phrase");
  };

  const closeDeleteAccountFlow = () => {
    setDeleteAccountFlow("closed");
    setDeletePhraseInput("");
    setDeletePhraseError(null);
  };

  const tryAdvanceToFinalDeleteStep = () => {
    setDeletePhraseError(null);
    if (deletePhraseInput.trim() !== "Delete") {
      setDeletePhraseError("Please type Delete exactly to confirm.");
      return;
    }
    setDeleteAccountFlow("final");
  };

  const confirmDeleteAccount = () => {
    closeDeleteAccountFlow();
    clearAuthAndRedirectToSignIn(navigate);
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
      navigate("/signin");
      return false;
    }

    setSavingPassword(true);
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
      });

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
          clearAuthAndRedirectToSignIn(navigate);
          return false;
        }
        setPasswordUpdateError(apiError || "Failed to update password");
        return false;
      }

      return true;
    } catch (err) {
      console.error("[API] /api/profile/password error:", err);
      setPasswordUpdateError(
        err instanceof Error ? err.message : "Failed to update password"
      );
      return false;
    } finally {
      setSavingPassword(false);
    }
  };

  const handleEditSubmit = async (_e: React.FormEvent): Promise<boolean> => {
    if (!user) return false;

    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/signin");
      return false;
    }

    const payload = {
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim(),
      mobile: editForm.mobile.trim(),
    };

    setProfileSaveError(null);
    setSavingProfile(true);
    try {
      const response = await fetch(getApiUrl("/api/profile/update"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          clearAuthAndRedirectToSignIn(navigate);
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
      console.error("[API] /api/profile/update error:", err);
      setProfileSaveError(
        err instanceof Error ? err.message : "Failed to update profile"
      );
      return false;
    } finally {
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
  const navigate = useNavigate();

  const fetchMyListings = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { navigate("/signin"); return; }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mylistings"), {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          clearAuthAndRedirectToSignIn(navigate);
          return;
        }
        throw new Error(payload.error || payload.message || "Failed to fetch listings");
      }

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
    } catch (err) {
      console.error("[API] /api/mylistings error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch listings");
      setUserListings([]);
    } finally {
      setLoading(false);
    }
  };

  return { userListings, loading, error, fetchMyListings };
};

// ─── useMyBids ────────────────────────────────────────────────────────────────

export const useMyBids = () => {
  const [userBids, setUserBids] = useState<BidCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchMyBids = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { navigate("/signin"); return; }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mybids"), {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          clearAuthAndRedirectToSignIn(navigate);
          return;
        }
        throw new Error(payload.error || payload.message || "Failed to fetch bids");
      }

      const raw: MyBidsApiItem[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.bids) ? payload.bids : [];

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
    } catch (err) {
      console.error("[API] /api/mybids error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch bids");
      setUserBids([]);
    } finally {
      setLoading(false);
    }
  };

  return { userBids, loading, error, fetchMyBids };
};