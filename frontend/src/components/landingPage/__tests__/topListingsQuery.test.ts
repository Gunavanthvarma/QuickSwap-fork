import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchTopListings,
  mapTopListingsToStripItems,
  type TopListingsResponse,
} from "../topListingsQuery";

describe("topListingsQuery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("maps API items to strip items with formatted name/price/tag", () => {
    const out = mapTopListingsToStripItems(
      [
        {
          id: "l1",
          title: "MacBook",
          subtitle: "M2 Air",
          image: "img.jpg",
          current_bid: 999.49,
          auction_end_time: "2026-05-01T10:00:00Z",
        },
      ],
      "Trending",
    );

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "l1",
      name: "MacBook · M2 Air",
      image: "img.jpg",
      tag: "Trending",
      endTime: "2026-05-01T10:00:00Z",
    });
    expect(out[0]?.price).toContain("Current bid:");
  });

  it("returns empty array when items is null/undefined", () => {
    expect(mapTopListingsToStripItems(null, "Trending")).toEqual([]);
    expect(mapTopListingsToStripItems(undefined, "Trending")).toEqual([]);
  });

  it("fetchTopListings sends auth header and returns payload", async () => {
    localStorage.setItem("accessToken", "t123");
    const payload: TopListingsResponse = {
      ending_soon: [],
      starting_soon: [],
      trending_now: [],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await fetchTopListings();
    expect(out).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/toplistings");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer t123",
      }),
    });
  });
});
