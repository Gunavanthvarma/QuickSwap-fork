import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthStorage,
  getValidUserFromStorage,
  notifyAuthSessionExpired,
  readUserFromStorage,
} from "../auth-context";

const userJson = JSON.stringify({
  id: "u1",
  email: "a@b.com",
  first_name: "A",
  last_name: "B",
});

describe("auth-context helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("clearAuthStorage", () => {
    it("removes token, refresh, expiry, and user keys", () => {
      localStorage.setItem("accessToken", "t");
      localStorage.setItem("refreshToken", "r");
      localStorage.setItem("accessTokenExpiry", "123");
      localStorage.setItem("user", userJson);
      clearAuthStorage();
      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(localStorage.getItem("refreshToken")).toBeNull();
      expect(localStorage.getItem("accessTokenExpiry")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });
  });

  describe("readUserFromStorage", () => {
    it("returns parsed user when JSON has string email", () => {
      localStorage.setItem("user", userJson);
      const u = readUserFromStorage();
      expect(u?.email).toBe("a@b.com");
      expect(u?.id).toBe("u1");
    });

    it("returns null when missing or invalid", () => {
      expect(readUserFromStorage()).toBeNull();
      localStorage.setItem("user", "{}");
      expect(readUserFromStorage()).toBeNull();
      localStorage.setItem("user", "{not json");
      expect(readUserFromStorage()).toBeNull();
    });
  });

  describe("getValidUserFromStorage", () => {
    it("returns null without access token", () => {
      localStorage.setItem("user", userJson);
      expect(getValidUserFromStorage()).toBeNull();
    });

    it("returns null without user", () => {
      localStorage.setItem("accessToken", "tok");
      expect(getValidUserFromStorage()).toBeNull();
    });

    it("returns user when token and user present and expiry absent", () => {
      localStorage.setItem("accessToken", "tok");
      localStorage.setItem("user", userJson);
      expect(getValidUserFromStorage()?.email).toBe("a@b.com");
    });

    it("clears storage and returns null when access token is past expiry (with skew)", () => {
      localStorage.setItem("accessToken", "tok");
      localStorage.setItem("user", userJson);
      const past = Date.now() - 60_000;
      localStorage.setItem("accessTokenExpiry", String(past));
      expect(getValidUserFromStorage()).toBeNull();
      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("returns user when expiry is in the future beyond skew", () => {
      localStorage.setItem("accessToken", "tok");
      localStorage.setItem("user", userJson);
      const future = Date.now() + 120_000;
      localStorage.setItem("accessTokenExpiry", String(future));
      expect(getValidUserFromStorage()?.id).toBe("u1");
    });
  });

  describe("notifyAuthSessionExpired", () => {
    it("clears storage and dispatches session event", () => {
      const spy = vi.fn();
      window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, spy);
      localStorage.setItem("accessToken", "tok");
      localStorage.setItem("user", userJson);
      notifyAuthSessionExpired();
      expect(localStorage.getItem("accessToken")).toBeNull();
      expect(spy).toHaveBeenCalledTimes(1);
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, spy);
    });
  });
});
