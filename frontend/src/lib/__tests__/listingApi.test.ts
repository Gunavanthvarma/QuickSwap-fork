import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  deleteListing,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../listingApi";

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe("listingApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({})),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("fetchNotifications", () => {
    it("returns filtered notifications on success", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({
          notifications: [
            {
              id: "n1",
              user_id: "u1",
              type: "bid",
              title: "Hello",
              message: "World",
              listing_id: "L1",
              is_read: false,
              created_at: "2026-01-01T00:00:00.000Z",
            },
            { id: 2, title: "bad", message: "skip" },
          ],
        }),
      );
      const list = await fetchNotifications("tok");
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: "n1", title: "Hello", message: "World" });
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/api/notifications"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ Authorization: "Bearer tok" }),
        }),
      );
    });

    it("returns empty array when response is not an object with notifications array", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(null));
      expect(await fetchNotifications("tok")).toEqual([]);
    });

    it("throws with API error message when not ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: "nope" }, false, 500),
      );
      await expect(fetchNotifications("tok")).rejects.toThrow("nope");
    });
  });

  describe("fetchUnreadNotificationCount", () => {
    it("returns unread_count when present", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ unread_count: 7 }));
      expect(await fetchUnreadNotificationCount("tok")).toBe(7);
    });

    it("returns 0 when unread_count missing or invalid", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}));
      expect(await fetchUnreadNotificationCount("tok")).toBe(0);
    });

    it("throws when response not ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ message: "fail" }, false, 401),
      );
      await expect(fetchUnreadNotificationCount("tok")).rejects.toThrow("fail");
    });
  });

  describe("markAllNotificationsRead", () => {
    it("resolves when ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}));
      await expect(markAllNotificationsRead("tok")).resolves.toBeUndefined();
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("/api/notifications/read-all"),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("throws when not ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: "bad" }, false, 400),
      );
      await expect(markAllNotificationsRead("tok")).rejects.toThrow("bad");
    });
  });

  describe("markNotificationRead", () => {
    it("PUTs to encoded id path", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}));
      await markNotificationRead("tok", "id/with/slash");
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("id/with/slash")),
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  describe("deleteListing", () => {
    it("DELETEs listing and resolves when ok", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}));
      await deleteListing("listing-1", "tok");
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining("listing?id=listing-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("throws on error body", async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error: "cannot delete" }, false, 403),
      );
      await expect(deleteListing("x", "tok")).rejects.toThrow("cannot delete");
    });
  });
});
