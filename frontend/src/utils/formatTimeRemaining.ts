/**
 * Formats remaining duration for listings (frontend-only).
 * - More than 24h: "1D6hrs" (days + remaining hours in the last partial day)
 * - At most 24h: hours (and minutes when not whole hours), or minutes if under 1h
 */

export function formatTimeRemainingFromMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "Ended";

  const hourMs = 60 * 60 * 1000;
  const totalHours = ms / hourMs;

  if (totalHours > 24) {
    const days = Math.floor(totalHours / 24);
    const hours = Math.floor(totalHours % 24);
    return `${days}D${hours}hrs`;
  }

  const totalMins = Math.floor(ms / (60 * 1000));
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return m === 0 ? `${h}hrs` : `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTimeRemainingFromEnd(iso: string, now: number = Date.now()): string {
  const end = Date.parse(iso);
  if (Number.isNaN(end)) return "Ended";
  return formatTimeRemainingFromMs(end - now);
}

/**
 * Parses common backend `time_left` shapes and applies the same display rules.
 * Falls back to the original string if unrecognized (e.g. already "Ended").
 */
export function formatTimeRemainingFromBackendString(raw: string): string {
  const s = raw?.trim();
  if (!s || s === "Ended") return s || "Ended";

  let ms: number | null = null;

  const hms = s.match(/^(\d+)h\s*(\d+)m(?:\s*(\d+)s)?$/);
  if (hms) {
    const h = parseInt(hms[1], 10);
    const m = parseInt(hms[2], 10);
    const sec = hms[3] ? parseInt(hms[3], 10) : 0;
    ms = ((h * 60 + m) * 60 + sec) * 1000;
  }

  if (ms === null) {
    const ho = s.match(/^(\d+)h$/);
    if (ho) ms = parseInt(ho[1], 10) * 60 * 60 * 1000;
  }

  if (ms === null) {
    const mo = s.match(/^(\d+)m$/);
    if (mo) ms = parseInt(mo[1], 10) * 60 * 1000;
  }

  if (ms === null) {
    const mleft = s.match(/^(\d+)m\s*left$/i);
    if (mleft) ms = parseInt(mleft[1], 10) * 60 * 1000;
  }

  if (ms === null) return raw;
  return formatTimeRemainingFromMs(ms);
}
