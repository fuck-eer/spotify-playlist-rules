import { describe, expect, it } from "vitest";
import vectors from "../fixtures/prng.json";
import { mulberry32, seededShuffle } from "./prng.js";

describe("prng.json vectors (shared with Kotlin)", () => {
  it.each(vectors.mulberry32)("mulberry32($seed)", ({ seed, first }) => {
    const r = mulberry32(seed);
    expect(first.map(() => r())).toEqual(first);
  });
  it.each(vectors.shuffle)("seededShuffle seed $seed", ({ seed, input, output }) => {
    expect(seededShuffle(input, seed)).toEqual(output);
  });
});
