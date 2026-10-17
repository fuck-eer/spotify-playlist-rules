import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MixState } from "./mix-state";
import { BUILD_FAILED, safeBuildFromState, useMixState } from "./use-mix-state";

const T = (id: string) => `spotify:track:${id}`;
const state = (removedPlays: number): MixState =>
  ({
    mix: { id: "m", name: "M", keepSourceOrder: true, shuffleSeed: 1 },
    rules: [
      {
        id: "r",
        ruleId: "l",
        kind: "pin_first",
        n: null,
        position: 0,
        trackUri: T("a"),
        removedPlays,
        deletedCopies: [],
      },
    ],
    source: [
      { uri: T("a"), name: "A", artists: [] },
      { uri: T("b"), name: "B", artists: [] },
    ],
    tracks: {},
    arrangement: { manualOrder: null, bench: [], version: 0 },
  }) as unknown as MixState;

afterEach(() => vi.unstubAllGlobals());

describe("build guard (B1)", () => {
  it("safeBuildFromState returns null instead of throwing", () => {
    expect(safeBuildFromState(state(0))?.nodes.length).toBe(3);
    expect(safeBuildFromState(state(1))).toBeNull();
  });

  it("useMixState shows an error state for an unbuildable Mix instead of crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(state(1)))),
    );
    const { result } = renderHook(() => useMixState("m"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(BUILD_FAILED);
    expect(result.current.result).toBeNull();
    act(() => result.current.replace(state(0)));
    expect(result.current.status).toBe("ready");
    expect(result.current.result?.nodes).toHaveLength(3);
  });
});
