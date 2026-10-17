import { expect, test } from "@playwright/test";
import { coverLabels, seedGymMix } from "./helpers/mix";

test("long-press drag reorders, saves, and persists after reload", async ({ page }) => {
  const mixId = await seedGymMix(page);
  await page.goto(`/mixes/${mixId}`);
  const echo = page.getByRole("button", { name: "Slot 1, Echo by Kavi" });
  const sunrise = page.getByRole("button", { name: "Slot 3, Sunrise by Kavi" });
  await echo.waitFor({ timeout: 30_000 });
  const from = (await echo.boundingBox())!;
  const to = (await sunrise.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await expect(page.getByText(/Drop to play it here/)).toBeVisible();
  await page.mouse.up();
  await expect(
    page.locator("[data-sonner-toast]").getByText("Moved to slot 3. Order saved."),
  ).toBeVisible();
  const want = ["Slot 1, Drift by Oren", "Slot 2, Sunrise by Kavi", "Slot 3, Echo by Kavi"];
  await expect.poll(() => coverLabels(page)).toEqual(want);
  await page.reload();
  await expect(page.getByText(/your order/)).toBeVisible({ timeout: 30_000 });
  expect(await coverLabels(page)).toEqual(want);
});
