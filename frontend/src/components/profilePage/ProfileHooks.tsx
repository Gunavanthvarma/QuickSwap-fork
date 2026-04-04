import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { readUserFromStorage } from "../../auth/auth-context";
import { apiErrorMessage, authHeaders, getApiUrl, isRecord } from "../../lib/api";
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

  const navigate = useNavigate();

  useEffect(() => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        navigate("/signin");
        return;
      }

      const parsed = readUserFromStorage();
      if (!parsed) {
        navigate("/signin");
        return;
      }

      setUser(parsed);
    } catch (err: unknown) {
      console.error("Failed to parse user from local storage:", err);
      setError("Failed to load profile");
      navigate("/signin");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

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
  const navigate = useNavigate();

  const fetchMyListings = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { navigate("/signin"); return; }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mylistings"), {
        method: "GET",
        headers: authHeaders(token),
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
      console.error("[API] /api/mylistings error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch listings");
      setUserListings([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  return { userListings, loading, error, fetchMyListings };
};

// ─── useMyBids ────────────────────────────────────────────────────────────────

export const useMyBids = () => {
  const [userBids, setUserBids] = useState<BidCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchMyBids = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { navigate("/signin"); return; }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/api/mybids"), {
        method: "GET",
        headers: authHeaders(token),
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
      console.error("[API] /api/mybids error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch bids");
      setUserBids([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  return { userBids, loading, error, fetchMyBids };
};