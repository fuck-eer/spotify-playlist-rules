import { describe, expect, it } from "vitest";
import { isUuid } from "./validation";

describe("isUuid", () => {
  it("accepts uuids in any case", () => {
    expect(isUuid("0f8fad5b-d9cb-469f-a165-70867728950e")).toBe(true);
    expect(isUuid("0F8FAD5B-D9CB-469F-A165-70867728950E")).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });
  it("rejects anything else", () => {
    for (const v of ["", "not-a-uuid", "0f8fad5b-d9cb-469f-a165-70867728950", "0f8fad5b-d9cb-469f-a165-70867728950e ", "0f8fad5bd9cb469fa16570867728950e"]) {
      expect(isUuid(v)).toBe(false);
    }
  });
});
