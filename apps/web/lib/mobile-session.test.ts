import type { FakeSpotify } from "@rulemix/spotify/testing";
import type postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listMixes } from "../app/api/mixes/route";
import { DELETE, POST } from "../app/api/mobile/session/route";
import { getSql } from "./db/client";
import { canReachTestDb, closeTestDb, resetTestDb } from "./db/test-utils";
import { FAKE_ME } from "./testing/fake-library";
import { req, startRouteHarness } from "./testing/route-harness";

const reachable = await canReachTestDb();

describe.skipIf(!reachable)("mobile session (ADR-0034)", () => {
  let fake: FakeSpotify;
  let restore: () => void;
  let sql: postgres.Sql;
  let tokenStatus = 200;

  const post = (body: unknown) => POST(req("/api/mobile/session", null, { method: "POST", body }));
  const bearer = (path: string, token: string, method = "GET") => {
    const r = req(path, null, { method });
    r.headers.set("authorization", `Bearer ${token}`);
    return r;
  };

  beforeAll(async () => {
    ({ fake, restore } = await startRouteHarness());
    fake.on("POST", /\/api\/token$/, () =>
      tokenStatus === 200
        ? { body: { access_token: "AT", refresh_token: "RT-mobile", expires_in: 3600, scope: "s" } }
        : { status: 400, body: { error: "invalid_grant" } },
    );
  });
  beforeEach(async () => {
    sql = await resetTestDb();
    tokenStatus = 200;
    fake.calls.length = 0;
  });
  afterAll(async () => {
    await getSql().end();
    await closeTestDb();
    await fake.close();
    restore();
  });

  it("exchanges the code, upserts the user and creates a mobile session (sha256 only)", async () => {
    const log = vi.spyOn(console, "log");
    const res = await post({ code: "abc", redirectUri: "rulemix://callback" });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { token: string; expiresAt: string; user: unknown };
    expect(j.user).toEqual({ id: FAKE_ME, displayName: "Nishchay" });
    expect(j.token.length).toBeGreaterThan(30);
    expect(new Date(j.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const form = new URLSearchParams(
      fake.calls.find((c) => c.path.endsWith("/api/token"))!.rawBody,
    );
    expect(form.get("redirect_uri")).toBe("rulemix://callback");
    const rows = await sql<{ id_hash: string; kind: string }[]>`select id_hash, kind from sessions`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe("mobile");
    expect(rows[0]!.id_hash).not.toBe(j.token);
    const [u] = await sql<{ id: string }[]>`select id from users`;
    expect(u!.id).toBe(FAKE_ME);
    expect(JSON.stringify(log.mock.calls)).not.toContain(j.token);
    expect((await listMixes(bearer("/api/mixes", j.token))).status).toBe(200);
  });

  it("401 when Spotify rejects the code; 400 for a wrong redirect or bad body", async () => {
    tokenStatus = 400;
    expect((await post({ code: "abc", redirectUri: "rulemix://callback" })).status).toBe(401);
    expect((await post({ code: "abc", redirectUri: "https://evil.test/cb" })).status).toBe(400);
    expect((await post({ redirectUri: "rulemix://callback" })).status).toBe(400);
  });

  it("DELETE destroys the Bearer session; the token then gets 401", async () => {
    const { token } = (await (
      await post({ code: "abc", redirectUri: "rulemix://callback" })
    ).json()) as {
      token: string;
    };
    expect((await DELETE(bearer("/api/mobile/session", token, "DELETE"))).status).toBe(204);
    expect((await listMixes(bearer("/api/mixes", token))).status).toBe(401);
  });
});
