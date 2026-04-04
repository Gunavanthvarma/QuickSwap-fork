import { useState, useEffect, useCallback } from "react";
import { readUserFromStorage } from "../../auth/auth-context";
import { useSignInRedirect } from "../../auth/useSignInRedirect";
import { apiErrorMessage, authHeaders, getApiUrl, isFetchAborted, isRecord } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import type {
  ProfileResponse,
  EditFormState,
  ListingCardItem,
  BidCardItem,
  MyListingApiItem,
  MyBidsApiItem,
  MyListingsApiResponse,
  MyBidsApiResponse,
} from "./Profile.types";

export type ProfileFetchOptions = {
  signal?: AbortSignal;
};

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

  const redirectToSignin = useSignInRedirect();

  useEffect(() => {
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

      setUser(parsed);
    } catch (err: unknown) {
      console.error("Failed to parse user from local storage:", err);
      setError("Failed to load profile");
      redirectToSignin();
    } finally {
      setLoading(false);
    }
  }, [redirectToSignin]);

  const handleEditOpen = () => {
    if (user) {
      setEditForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        mobile: user.mobile || "",
      });
      setIsEditingProfile(true);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up PUT /api/profile when backend route is ready
    if (user) {
      const updatedUser = { ...user, ...editForm };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
    setIsEditingProfile(false);
  };

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email.split("@")[0] ?? "";

  return {
    user, loading, error, displayName,
    isEditingProfile, editForm, setEditForm,
    handleEditOpen, handleEditSubmit,
    closeEdit: () => setIsEditingProfile(false),
  };
};

// ─── useMyListings ────────────────────────────────────────────────────────────

export const useMyListings = () => {
  const [userListings, setUserListings] = useState<ListingCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectToSignin = useSignInRedirect();

  const fetchMyListings = useCallback(async (options?: ProfileFetchOptions) => {
    const { signal } = options ?? {};
    const token = localStorage.getItem("accessToken");
    if (!token) {
      redirectToSignin();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mylistings"), {
        method: "GET",
        headers: authHeaders(token),
        signal,
      });

      const rawJson: unknown = await response.json().catch(() => ({}));
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
            timeLeft: item.time_left || "Ended",
            bids: item.total_bids || 0,
            status: item.status?.toLowerCase() === "active" ? "active" : "sold",
          }))
        : [];

      setUserListings(listings);
    } catch (err: unknown) {
      if (isFetchAborted(err)) return;
      console.error("[API] /api/mylistings error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch listings");
      setUserListings([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
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
    const { signal } = options ?? {};
    const token = localStorage.getItem("accessToken");
    if (!token) {
      redirectToSignin();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mybids"), {
        method: "GET",
        headers: authHeaders(token),
        signal,
      });

      const rawJson: unknown = await response.json().catch(() => ({}));
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
          timeLeft: item.time_left || "Ended",
          status,
        };
      });

      setUserBids(bids);
    } catch (err: unknown) {
      if (isFetchAborted(err)) return;
      console.error("[API] /api/mybids error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch bids");
      setUserBids([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [redirectToSignin]);

  return { userBids, loading, error, fetchMyBids };
};