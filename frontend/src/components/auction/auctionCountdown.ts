/**
 * Live auction countdown helpers (story: sync with server when backend sends `time_sync` SSE).
 */

export interface TimeSyncPayload {
  server_time: string;
  auction_id: string;
  auction_end_unix?: number;
}

export function parseTimeSyncPayload(raw: string): TimeSyncPayload | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const server_time = o.server_time;
    const auction_id = o.auction_id;
    if (typeof server_time !== "string" || typeof auction_id !== "string") return null;
    const auction_end_unix = o.auction_end_unix;
    const out: TimeSyncPayload = { server_time, auction_id };
    if (typeof auction_end_unix === "number" && Number.isFinite(auction_end_unix)) {
      out.auction_end_unix = auction_end_unix;
    }
    return out;
  } catch {
    return null;
  }
}

/** Skew: estimated_server_now = Date.now() + skewMs */
export function computeServerSkewMs(serverTimeIso: string, clientNowMs: number): number | null {
  const serverMs = Date.parse(serverTimeIso);
  if (!Number.isFinite(serverMs)) return null;
  return serverMs - clientNowMs;
}

/** Remaining ms until end; uses skew when provided. */
export function remainingUntilEndMs(
  endMs: number,
  clientNowMs: number,
  serverSkewMs: number | null,
): number {
  const effectiveNow = clientNowMs + (serverSkewMs ?? 0);
  return endMs - effectiveNow;
}

export function formatCountdown(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "Ended";
  const s = Math.floor(remainingMs / 1000);
  const days = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (days > 0) return `${days}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function parseAuctionEndMsFromListing(auctionEndTime: string): number | null {
  const ms = Date.parse(auctionEndTime);
  return Number.isFinite(ms) ? ms : null;
}
