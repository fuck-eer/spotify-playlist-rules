import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "./index.js";

describe("rules-engine", () => {
  it("exposes ENGINE_VERSION as a string", () => {
    expect(typeof ENGINE_VERSION).toBe("string");
  });
});
