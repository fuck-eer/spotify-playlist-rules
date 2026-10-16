import { describe, expect, it } from "vitest";
import { mulberry32, seededShuffle } from "./prng.js";

describe("mulberry32", () => {
  it("yields the known first three values for seed 42", () => {
    const rand = mulberry32(42);
    expect([rand(), rand(), rand()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
    const again = mulberry32(42);
    expect([again(), again(), again()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
  });
});

describe("seededShuffle", () => {
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  it("returns a permutation of the input", () => {
    expect([...seededShuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });

  it("is deterministic per seed", () => {
    expect(seededShuffle(items, 7)).toEqual(seededShuffle(items, 7));
  });

  it("differs for seeds 1 and 2", () => {
    expect(seededShuffle(items, 1)).not.toEqual(seededShuffle(items, 2));
  });

  it("does not mutate its input", () => {
    const input = [...items];
    seededShuffle(input, 3);
    expect(input).toEqual(items);
  });
});
