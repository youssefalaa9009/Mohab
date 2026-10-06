import { expect, test } from "./fixtures";

test.describe("bag", () => {
  test("asks for a size, adds, updates and persists", async ({ page, context }) => {
    await page.goto("/products/loopback-hoodie");

    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("alert")).toHaveText("Please choose a size.");

    await page.locator('label:has(input[name="size"][value="M"])').click();
    await page.getByRole("button", { name: "Add to bag" }).click();

    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Loopback Hoodie")).toBeVisible();
    // The open drawer makes the page behind it inert, so the header is hidden
    // from the accessibility tree while it is open.
    await expect(
      page.getByRole("link", { name: "Bag, 1 item", includeHidden: true }),
    ).toBeAttached();

    await drawer.getByRole("button", { name: "Increase quantity" }).click();
    await expect(drawer.getByText("Subtotal").locator("..")).toContainText("4,800");

    const cookie = (await context.cookies()).find((c) => c.name === "quattro_cart");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");

    // Server-side bag: survives a full reload.
    await page.goto("/cart");
    await expect(page.getByRole("link", { name: "Loopback Hoodie" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Remove" }).first().click();
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
  });

  test("rejects an unknown promo code once, inline", async ({ page }) => {
    await page.goto("/products/canvas-tote"); // one-size accessory
    await page.getByRole("button", { name: "Add to bag" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("Promo code").fill("NOPE");
    await drawer.getByRole("button", { name: "Apply" }).click();
    await expect(drawer.locator("#coupon-error")).toHaveText("This code isn’t valid.");
    // Announced by the inline alert only — not repeated in the drawer's live region.
    await expect(drawer.getByText("This code isn’t valid.")).toHaveCount(1);
  });

  test("sold-out products cannot be added", async ({ page }) => {
    await page.goto("/products/oversized-hoodie");
    await expect(page.getByRole("button", { name: "Sold out" }).first()).toBeDisabled();
  });

  test("mutations require JSON from this origin", async ({ page }) => {
    await page.goto("/");
    const status = await page.evaluate(
      async () =>
        (
          await fetch("/api/cart/items", {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: "{}",
          })
        ).status,
    );
    expect(status).toBe(415);
  });
});
