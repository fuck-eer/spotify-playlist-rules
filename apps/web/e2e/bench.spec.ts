import { expect, test } from "@playwright/test";
import { coverLabels, seedGymMix } from "./helpers/mix";

const PORT = Number(process.env.E2E_PORT ?? 3000);
const FAKE = `http://127.0.0.1:${Number(process.env.E2E_FAKE_SPOTIFY_PORT ?? PORT + 1000)}`;
type Write = { method: string; playlistId: string; uris: string[] };
const writes = async (): Promise<Write[]> =>
  (await (await fetch(`${FAKE}/v1/__test/items`)).json()) as Write[];

test("bench a song, it stays benched after reload and Play skips it; bring it back to slot 3", async ({
  page,
}) => {
  const mixId = await seedGymMix(page);
  await page.goto(`/mixes/${mixId}`);
  await page.getByRole("button", { name: "Slot 1, Echo by Kavi" }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: "Move to bench" }).click();
  await expect(page.getByText("Benched. Tap the bench to bring it back.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bench, 1 song. Tap to open." })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Bench, 1 song. Tap to open." })).toBeVisible({
    timeout: 30_000,
  });
  expect(await coverLabels(page)).toEqual(["Slot 1, Drift by Oren", "Slot 2, Sunrise by Kavi"]);

  const before = (await writes()).length;
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("dialog", { name: "rulemix player is ready" })).toBeVisible({
    timeout: 30_000,
  });
  const played = (await writes()).slice(before).flatMap((w) => w.uris);
  expect(played.length).toBeGreaterThan(0);
  expect(played).not.toContain("spotify:track:echo");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Bench, 1 song. Tap to open." }).click();
  await page.getByRole("button", { name: "Echo, Kavi" }).click();
  await page.getByRole("menuitem", { name: "Put back at slot…" }).click();
  await page.getByTestId("bench-panel").getByLabel("Slot number").fill("3");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Back in at slot 3")).toBeVisible();
  await expect
    .poll(() => coverLabels(page))
    .toEqual(["Slot 1, Drift by Oren", "Slot 2, Sunrise by Kavi", "Slot 3, Echo by Kavi"]);
  await expect(page.getByTestId("bench-cluster")).toHaveCount(0);
});

test("long-press drag onto the Bench target benches the song", async ({ page }) => {
  const mixId = await seedGymMix(page);
  await page.goto(`/mixes/${mixId}`);
  const drift = page.getByRole("button", { name: "Slot 2, Drift by Oren" });
  await drift.waitFor({ timeout: 30_000 });
  const b = (await drift.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.move(b.x + 20, b.y + 20, { steps: 3 });
  const target = page.getByTestId("bench-target");
  await expect(target).toHaveAttribute("data-kind", "bench");
  const t = (await target.boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 });
  await expect(target).toHaveText("Drop to bench");
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Bench, 1 song. Tap to open." })).toBeVisible();
  expect(await coverLabels(page)).toEqual(["Slot 1, Echo by Kavi", "Slot 2, Sunrise by Kavi"]);
});
