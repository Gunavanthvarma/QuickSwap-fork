import { describe, it, expect } from "vitest";
import {
  computeServerSkewMs,
  formatCountdown,
  parseTimeSyncPayload,
  remainingUntilEndMs,
} from "../auctionCountdown";

describe("auctionCountdown", () => {
  it("parseTimeSyncPayload reads optional auction_end_unix", () => {
    const raw = JSON.stringify({
      server_time: "2026-01-01T12:00:00.000Z",
      auction_id: "a1",
      auction_end_unix: 1704110400,
    });
    const p = parseTimeSyncPayload(raw);
    expect(p?.auction_id).toBe("a1");
    expect(p?.auction_end_unix).toBe(1704110400);
  });

  it("computeServerSkewMs", () => {
    const skew = computeServerSkewMs("2026-01-01T12:00:00.000Z", 0);
    expect(skew).toBe(Date.parse("2026-01-01T12:00:00.000Z"));
  });

  it("remainingUntilEndMs respects skew", () => {
    const end = 10_000;
    const rem = remainingUntilEndMs(end, 5000, 1000);
    expect(rem).toBe(4000);
  });

  it("formatCountdown", () => {
    expect(formatCountdown(-1)).toBe("Ended");
    expect(formatCountdown(90_000)).toMatch(/1m/);
  });
});
