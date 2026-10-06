import { expect, hydrated, test } from "./fixtures";

test.describe("search", () => {
  test("suggests as you type, tolerates typos and remembers searches", async ({ page }) => {
    await page.goto("/shop");
    await hydrated(page);
    await page.getByRole("link", { name: "Search", exact: true }).click();
    const panel = page.getByRole("dialog");
    const input = panel.getByRole("searchbox", { name: "Search products" });
    await expect(input).toBeFocused();

    // A misspelling still finds the hoodies.
    await input.fill("hodie");
    await expect(panel.getByText("3 products")).toBeVisible();
    await expect(panel.getByRole("link", { name: "Hoodies" })).toBeVisible();

    await input.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=hodie/);
    await expect(page.getByText("3 results for “hodie”")).toBeVisible();

    // The overlay now offers it as a recent search.
    await page.getByRole("link", { name: "Search", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "hodie" })).toBeVisible();
  });

  test("explains when nothing matches", async ({ page }) => {
    await page.goto("/search?q=zzzzqq");
    await expect(page.getByText("Nothing found")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Hoodies" })).toBeVisible();
  });
});
