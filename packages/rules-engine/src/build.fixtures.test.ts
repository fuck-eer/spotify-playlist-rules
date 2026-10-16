import { describe, expect, it } from "vitest";
import { build } from "./build.js";
import type { BuildInput, BuildResult } from "./types.js";

interface Fixture {
  name: string;
  input: BuildInput;
  expected: BuildResult;
}

// Minimal typing for Vite's import.meta.glob (vite is not a direct dependency).
declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: { eager: true; import: "default" }): Record<string, T>;
  }
}

// Loaded through Vite's import.meta.glob so src/ stays free of Node APIs.
const modules = import.meta.glob<Fixture>("../fixtures/*.json", { eager: true, import: "default" });
const files = Object.keys(modules).sort();

describe("shared fixtures", () => {
  it("has all 14 fixtures", () => {
    expect(files).toHaveLength(14);
  });

  it.each(files)("%s", (file) => {
    const fixture = modules[file] as Fixture;
    expect(build(fixture.input)).toEqual(fixture.expected);
  });
});
