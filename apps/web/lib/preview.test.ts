import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSql } from "./db/client";
import { addMixRule } from "./db/mix-rules-repo";
import { createMix, updateMix } from "./db/mixes-repo";
import { createRule } from "./db/rules-repo";
import { canReachTestDb, resetTestDb } from "./db/test-utils";
import { computePreview } from "./preview";
import { spotifyForUser } from "./spotify-for-user";
import { FAKE_ME } from "./testing/fake-library";
import { signInFakeUser, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();
const T = (id: string) => `spotify:track:${id}`;
const item = (id: string) => ({
  item: { uri: T(id), name: id.toUpperCase(), type: "track", artists: [{ name: "A" }] },
});

describe.skipIf(!reachable)("computePreview", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let mixId: string;

  /** Serves pl-test with the given items (null entries = local/unavailable). */
  function serve(ids: (string | null)[]): void {
    const items = ids.map((id) => (id ? item(id) : { is_local: true, item: null }));
    fake.on("GET", /\/playlists\/pl-test$/, () => ({ body: { items: { total: items.length } } }));
    fake.on("GET", /\/playlists\/pl-test\/items$/, () => ({
      body: { total: items.length, next: null, items },
    }));
    fake.on("GET", /\/me\/playlists$/, () => ({
      body: {
        next: null,
        items: [
          { id: "pl-test", name: "Test", owner: { id: FAKE_ME }, items: { total: items.length } },
        ],
      },
    }));
  }
  async function addRule(kind: "pin_first" | "every_n" | "repeat", n: number | null, uri: string) {
    const rule = await createRule(sql, FAKE_ME, { kind, n });
    const r = await addMixRule(sql, FAKE_ME, mixId, { ruleId: rule.id, trackUri: uri }, 10);
    if (!r.ok) throw new Error(r.code);
  }
  const preview = () => computePreview(sql, FAKE_ME, mixId, spotifyForUser(sql, FAKE_ME));

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    await signInFakeUser(sql);
    mixId = (
      await createMix(
        sql,
        FAKE_ME,
        { name: "T", source: { type: "playlist", id: "pl-test", name: "Test" } },
        42,
      )
    ).id;
  });
  afterAll(async () => {
    await getSql().end();
    await sql.end();
    await fake.close();
    restore();
  });

  it("summarises with plural and singular copy, and no skipped text without unavailable songs", async () => {
    serve(["a", "b", "c", "d"]);
    let p = await preview();
    expect(p.summary).toBe("4 tracks · 0 rules applied");
    expect(p.skippedText).toBeNull();
    await addRule("pin_first", null, T("c"));
    p = await preview();
    expect(p.summary).toBe("4 tracks · 1 rule applied");
    expect(p.kinds).toEqual(["pin_first"]);
    expect(p.names[T("c")]).toBe("C");
    await addRule("repeat", 2, T("a"));
    expect((await preview()).summary).toBe("5 tracks · 2 rules applied");
  });

  it("counts unavailable songs", async () => {
    serve(["a", null, "b", null]);
    expect((await preview()).skippedText).toBe("2 songs skipped (unavailable)");
    serve(["a", null, "b"]);
    expect((await preview()).skippedText).toBe("1 song skipped (unavailable)");
  });

  it("flags a rule whose song left the source", async () => {
    serve(["a", "b", "c"]);
    await addRule("pin_first", null, T("c"));
    serve(["a", "b"]);
    expect((await preview()).issues).toEqual([{ kind: "unavailable_rule_song", ruleIndex: 0 }]);
  });

  it("keeps source order when asked, and is deterministic for one seed", async () => {
    serve(["a", "b", "c", "d", "e", "f"]);
    await updateMix(sql, FAKE_ME, mixId, { keepSourceOrder: true });
    expect((await preview()).slots.map((s) => s.uri)).toEqual(
      ["a", "b", "c", "d", "e", "f"].map(T),
    );
    await updateMix(sql, FAKE_ME, mixId, { keepSourceOrder: false });
    const one = (await preview()).slots;
    expect((await preview()).slots).toEqual(one);
  });

  it("shifts a conflicting repeat after a pin on the same song", async () => {
    serve(["a", "b", "c"]);
    await updateMix(sql, FAKE_ME, mixId, { keepSourceOrder: true });
    await addRule("pin_first", null, T("b"));
    await addRule("repeat", 2, T("a"));
    const { slots } = await preview();
    expect(slots.some((s) => s.shiftedFrom === 0)).toBe(true);
    expect(slots[0]).toEqual({ uri: T("b"), ruleIndex: 0, shiftedFrom: null });
  });
});
