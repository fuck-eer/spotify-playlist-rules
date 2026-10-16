import { expect, test } from "@playwright/test";
import { seedSession } from "./helpers/session";

test("create a rule, see it in Active, archive it, see it in Archived", async ({ page }) => {
  await seedSession(page);
  await page.goto("/mixes");
  await page.getByRole("link", { name: "Rules" }).click();
  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByText("No rules yet")).toBeVisible();

  await page.getByRole("link", { name: "New rule" }).click();
  await expect(page.getByRole("heading", { name: "New rule" })).toBeVisible();
  await page.getByRole("button", { name: "Every N songs" }).click();
  await expect(page.getByTestId("rule-sentence")).toHaveText("Play a song after every 4 songs");
  await page.getByRole("button", { name: "Save rule" }).click();

  await expect(page).toHaveURL(/\/rules$/);
  const row = page.getByTestId("rule-row").filter({ hasText: "Play a song after every 4 songs" });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "More" }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(page.getByText("No rules here.")).toBeVisible();

  await page.getByRole("tab", { name: "Archived" }).click();
  await expect(
    page.getByTestId("rule-row").filter({ hasText: "Play a song after every 4 songs" }),
  ).toBeVisible();
});
