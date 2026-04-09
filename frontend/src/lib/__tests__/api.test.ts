import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiErrorMessage, getApiUrl, getSSEUrl, isFetchAborted, isRecord } from "../api";

describe("isRecord", () => {
  it("returns false for null and undefined", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });

  it("returns false for arrays and primitives", () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(1)).toBe(false);
  });

  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });
});

describe("isFetchAborted", () => {
  it("detects AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isFetchAborted(err)).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isFetchAborted(new Error("fail"))).toBe(false);
  });
});

describe("getApiUrl / getSSEUrl", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("getApiUrl returns relative path when VITE_API_BASE is empty", () => {
    expect(getApiUrl("/api/foo")).toBe("/api/foo");
  });

  it("getSSEUrl makes relative API path absolute for EventSource", () => {
    const u = getSSEUrl("/api/ws/auctions/abc");
    expect(u.startsWith("http://") || u.startsWith("https://")).toBe(true);
    expect(u).toContain("/api/ws/auctions/abc");
  });
});

describe("apiErrorMessage", () => {
  it("prefers error over message", () => {
    expect(apiErrorMessage({ error: "e", message: "m" }, "f")).toBe("e");
  });

  it("uses message when error missing", () => {
    expect(apiErrorMessage({ message: "m" }, "f")).toBe("m");
  });

  it("returns fallback for non-objects", () => {
    expect(apiErrorMessage(null, "f")).toBe("f");
    expect(apiErrorMessage("x", "f")).toBe("f");
  });
});
