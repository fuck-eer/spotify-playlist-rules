import { describe, expect, it } from "vitest";
import { SPOTIFY_PACKAGE } from "./index.js";

describe("spotify", () => {
  it("identifies itself", () => {
    expect(SPOTIFY_PACKAGE).toBe("spotify");
  });
});
