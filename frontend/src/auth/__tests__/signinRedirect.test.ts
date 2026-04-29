import { describe, expect, it } from "vitest";
import { getSafeReturnPath } from "../signinRedirect";

describe("getSafeReturnPath", () => {
  it("returns '/' for missing/invalid path", () => {
    expect(getSafeReturnPath(null)).toBe("/");
    expect(getSafeReturnPath({ from: { pathname: "relative" } })).toBe("/");
    expect(getSafeReturnPath({ from: { pathname: "//evil.com" } })).toBe("/");
  });

  it("blocks auth routes from redirect loop", () => {
    expect(getSafeReturnPath({ from: { pathname: "/signin" } })).toBe("/");
    expect(getSafeReturnPath({ from: { pathname: "/signup" } })).toBe("/");
  });

  it("keeps safe in-app path including query/hash", () => {
    expect(
      getSafeReturnPath({
        from: { pathname: "/profile", search: "?tab=bids", hash: "#x" },
      }),
    ).toBe("/profile?tab=bids#x");
  });
});
