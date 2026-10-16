import { expect, test } from "@playwright/test";

test("home page renders the wordmark", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.getByText("rulemix")).toBeVisible();
});
