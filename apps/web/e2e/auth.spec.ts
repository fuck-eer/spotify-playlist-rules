import { expect, test } from "@playwright/test";

test("unauthenticated /mixes redirects to sign-in", async ({ page }) => {
  await page.goto("/mixes");
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  await expect(page.getByText("Your playlist, your order. Spotify just plays it.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Spotify" })).toBeVisible();
});

test("failed sign-in shows retry copy", async ({ page }) => {
  await page.goto("/?error=denied");
  await expect(page.getByText("Sign-in didn't finish. Try again.")).toBeVisible();
});
