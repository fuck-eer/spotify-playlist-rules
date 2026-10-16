import { describe, expect, it } from "vitest";
import { mixMetaLine } from "./mix-meta";

const NOW = new Date("2026-10-16T12:00:00Z");
const base = { source: { type: "liked" as const, id: null, name: "Liked Songs" }, ruleCount: 3 };

describe("mixMetaLine", () => {
  it("says not generated when never saved", () => {
    expect(mixMetaLine({ ...base, lastSavedAt: null }, NOW)).toBe(
      "Liked Songs · 3 rules · not generated",
    );
  });
  it("uses relative save time", () => {
    const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    expect(mixMetaLine({ ...base, lastSavedAt: at(20_000) }, NOW)).toBe(
      "Liked Songs · 3 rules · just now",
    );
    expect(mixMetaLine({ ...base, lastSavedAt: at(5 * 60_000) }, NOW)).toBe(
      "Liked Songs · 3 rules · 5m ago",
    );
    expect(mixMetaLine({ ...base, lastSavedAt: at(2 * 3600_000) }, NOW)).toBe(
      "Liked Songs · 3 rules · 2h ago",
    );
    expect(mixMetaLine({ ...base, lastSavedAt: at(3 * 86400_000) }, NOW)).toBe(
      "Liked Songs · 3 rules · 3d ago",
    );
  });
  it("singular rule", () => {
    expect(mixMetaLine({ ...base, ruleCount: 1, lastSavedAt: null }, NOW)).toBe(
      "Liked Songs · 1 rule · not generated",
    );
  });
});
