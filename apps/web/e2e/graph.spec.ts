import { expect, test } from "@playwright/test";
import { coverLabels, seedGymMix } from "./helpers/mix";

test("tap a cover, add After every 4 from the popover, and see the copy", async ({ page }) => {
  const mixId = await seedGymMix(page);
  await page.goto(`/mixes/${mixId}`);
  await page.getByRole("button", { name: "Slot 2, Drift by Oren" }).click({ timeout: 30_000 });
  await expect(page.getByTestId("song-popover")).toBeVisible();
  await page.getByRole("button", { name: "After every N" }).click();
  await expect(page.getByTestId("stepper-value")).toHaveText("4");
  await page.getByTestId("stepper").getByRole("button", { name: "Add", exact: true }).click();
  // B = 3, n = 4: one copy (ADR-0019) at the last slot.
  await expect(page.getByText("4 songs · 1 rule")).toBeVisible();
  expect(await coverLabels(page)).toEqual([
    "Slot 1, Echo by Kavi",
    "Slot 2, Drift by Oren",
    "Slot 3, Sunrise by Kavi",
    "Slot 4, Drift by Oren, rule #1 After every 4",
  ]);
});
