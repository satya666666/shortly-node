import { describe, expect, it } from "vitest";
import { generateCode, normalizeUrl } from "../src/utils/codes.js";

describe("generateCode", () => {
  it("returns 7-character codes from the unambiguous alphabet", () => {
    const code = generateCode((n) => new Uint8Array(n).fill(3));
    expect(code).toHaveLength(7);
    expect(code).toMatch(/^[23456789a-z]+$/i);
  });

  it("never emits the reserved '-' character", () => {
    // max byte values map to the last alphabet char; verify across patterns
    for (let seed = 0; seed < 20; seed++) {
      const code = generateCode((n) => new Uint8Array(n).fill(seed % 256));
      expect(code).not.toContain("-");
    }
  });
});

describe("normalizeUrl", () => {
  it("adds https scheme when missing and strips fragments", () => {
    expect(normalizeUrl("example.com/a#x")).toBe("https://example.com/a");
  });

  it("keeps query strings", () => {
    expect(normalizeUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
  });

  it("rejects garbage, empty strings and dangerous schemes", () => {
    expect(normalizeUrl("not a url ???")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://example.com")).toBeNull();
  });
});
