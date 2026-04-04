import { useQuery } from "@tanstack/react-query";
import { apiErrorMessage, authHeaders, getApiUrl } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import type { StripItem } from "./top_listings_strip";

export interface TopListingApiItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  current_bid: number;
  auction_start_time?: string;
  auction_end_time?: string;
}

export interface TopListingsResponse {
  ending_soon: TopListingApiItem[] | null;
  starting_soon: TopListingApiItem[] | null;
  trending_now: TopListingApiItem[] | null;
}

const emptyPayload: TopListingsResponse = {
  ending_soon: null,
  starting_soon: null,
  trending_now: null,
};

/** How long cached /api/toplistings data is considered fresh (avoids duplicate fetches when navigating home ↔ explore). */
export const TOP_LISTINGS_STALE_MS = 45_000;

export const topListingsQueryKey = ["toplistings"] as const;

export async function fetchTopListings(): Promise<TopListingsResponse> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(getApiUrl("/api/toplistings"), {
    method: "GET",
    headers: authHeaders(token),
  });

  const payload = (await response.json().catch(() => emptyPayload)) as TopListingsResponse;

  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, "Failed to fetch top listings"));
  }

  return payload;
}

export function mapTopListingsToStripItems(
  items: TopListingApiItem[] | null | undefined,
  tag: string,
): StripItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    id: item.id,
    name: item.subtitle ? `${item.title} · ${item.subtitle}` : item.title,
    price: `Current bid: ${formatCurrency(item.current_bid)}`,
    image: item.image,
    tag,
  }));
}

export function useTopListingsQuery() {
  return useQuery({
    queryKey: topListingsQueryKey,
    queryFn: fetchTopListings,
    staleTime: TOP_LISTINGS_STALE_MS,
  });
}
