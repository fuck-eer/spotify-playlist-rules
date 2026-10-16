import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingHttpHeaders;
  rawBody: string;
  json: unknown;
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type FakeHandler = (req: FakeRequest) => FakeResponse | Promise<FakeResponse>;

export interface FakeSpotify {
  /** Base URL, e.g. http://127.0.0.1:PORT. Use as both accountsBaseUrl and apiBaseUrl. */
  readonly url: string;
  /** Every request received, in order. */
  readonly calls: FakeRequest[];
  /** Register a route. The most recently registered matching route wins. */
  on(method: string, path: RegExp, handler: FakeHandler): void;
  close(): Promise<void>;
}

interface Route {
  method: string;
  path: RegExp;
  handler: FakeHandler;
}

function parseJson(raw: string): unknown {
  if (raw === "") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** A tiny programmable HTTP server standing in for accounts.spotify.com and api.spotify.com. */
export async function startFakeSpotify(): Promise<FakeSpotify> {
  const routes: Route[] = [];
  const calls: FakeRequest[] = [];

  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const u = new URL(req.url ?? "/", "http://fake");
      const fr: FakeRequest = {
        method: req.method ?? "GET",
        path: u.pathname,
        query: u.searchParams,
        headers: req.headers,
        rawBody,
        json: parseJson(rawBody),
      };
      calls.push(fr);
      const route = [...routes]
        .reverse()
        .find((r) => r.method === fr.method && r.path.test(fr.path));
      const respond = (r: FakeResponse): void => {
        const status = r.status ?? 200;
        const headers: Record<string, string> = { ...(r.headers ?? {}) };
        if (r.body === undefined) {
          res.writeHead(status, headers).end();
          return;
        }
        headers["content-type"] ??= "application/json";
        res.writeHead(status, headers).end(JSON.stringify(r.body));
      };
      if (!route) {
        respond({ status: 404, body: { error: { status: 404, message: "no fake route" } } });
        return;
      }
      Promise.resolve(route.handler(fr)).then(respond, (e: unknown) =>
        respond({ status: 500, body: { error: String(e) } }),
      );
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    on(method, path, handler) {
      routes.push({ method: method.toUpperCase(), path, handler });
    },
    close: () =>
      new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
