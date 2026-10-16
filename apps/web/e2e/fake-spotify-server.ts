// Standalone fake Spotify for e2e: `tsx apps/web/e2e/fake-spotify-server.ts <port>`.
import { createServer, request } from "node:http";
import { startFakeSpotify } from "@rulemix/spotify/testing";
import { installFakeLibrary } from "../lib/testing/fake-library";
import { installFakeWrites } from "../lib/testing/fake-writes";

const port = Number(process.argv[2] ?? 3999);
const fake = await startFakeSpotify();
installFakeLibrary(fake);
installFakeWrites(fake);
const upstream = new URL(fake.url);

// Proxy a fixed port onto the fake's ephemeral one.
createServer((req, res) => {
  const p = request(
    {
      host: upstream.hostname,
      port: upstream.port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  req.pipe(p);
}).listen(port, "127.0.0.1", () => console.log(`fake spotify on ${port}`));
