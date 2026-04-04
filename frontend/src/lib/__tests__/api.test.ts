import { describe, it, expect } from "vitest";
import { apiErrorMessage, isRecord } from "../api";

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
