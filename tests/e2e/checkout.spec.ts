import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/** A fresh, valid Egyptian mobile number per test, so per-phone limits never collide. */
function randomPhone() {
  return `010${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

async function addToBag(page: Page, slug: string, size?: string) {
  await page.goto(`/products/${slug}`);
  if (size) await page.locator(`label:has(input[name="size"][value="${size}"])`).click();
  await page.getByRole("button", { name: "Add to bag" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillAddress(page: Page, phone: string) {
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByLabel("Full name").fill("Test Customer");
  await page.getByLabel("Governorate").selectOption("Cairo");
  await page.getByLabel("City / area").fill("Zamalek");
  await page.getByLabel("Street address").fill("12 Example Street");
  // The demo catalog ships one free, clearly labelled delivery option.
  await expect(page.getByRole("radio", { name: /Standard delivery/ })).toBeChecked();
}

test.describe("checkout", () => {
  test("validates, places a cash-on-delivery order and confirms it", async ({ page, request }) => {
    await addToBag(page, "loopback-hoodie", "M");
    await page.goto("/checkout");

    // Nothing filled in: inline errors, focus moves to the first problem.
    await page.getByRole("button", { name: /Place order/ }).click();
    await expect(page.getByRole("alert").first()).toHaveText(
      "Please check the highlighted fields.",
    );
    await expect(page.getByLabel("Mobile number")).toBeFocused();
    await expect(page.getByText("Enter an Egyptian mobile number")).toBeVisible();

    const phone = randomPhone();
    await fillAddress(page, phone);
    await page.getByRole("button", { name: /Place order · EGP 2,400/ }).click();

    await expect(
      page.getByRole("heading", { name: "Thank you — your order is in." }),
    ).toBeVisible();
    // textContent, not innerText: the label is uppercased by CSS.
    const number = (await page.getByText(/^Order Q-\d+$/).textContent())!.replace("Order ", "");
    await expect(page.getByText("Pay EGP 2,400 in cash when your order arrives.")).toBeVisible();

    // The bag was emptied.
    await expect(page.getByRole("link", { name: "Bag, empty" })).toBeAttached();

    // The confirmation link is the only way in for a guest: without its key, 404.
    const withoutKey = await request.get(`/api/orders/${number}`);
    expect(withoutKey.status()).toBe(404);
    const wrongKey = await request.get(`/api/orders/${number}?key=nope`);
    expect(wrongKey.status()).toBe(404);

    // Order tracking: number + the phone it was placed with (in any format).
    const tracked = await request.post("/api/orders/track", {
      data: { number, phone: `+20${phone.slice(1)}` },
    });
    expect(tracked.status()).toBe(200);
    expect((await tracked.json()).status).toBe("awaiting_confirmation");
    const wrongPhone = await request.post("/api/orders/track", {
      data: { number, phone: randomPhone() },
    });
    expect(wrongPhone.status()).toBe(404);
  });

  test("limits unconfirmed orders per phone", async ({ page }) => {
    const phone = randomPhone();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      // Product 11 has 12 in stock: enough for desktop and mobile runs in parallel
      // (3 orders each). Product 10 has only 5 and ran out mid-suite.
      await addToBag(page, "ribbed-beanie");
      await page.goto("/checkout");
      await fillAddress(page, phone);
      await page.getByRole("button", { name: /Place order/ }).click();
      if (attempt <= 3) {
        await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible();
      } else {
        await expect(page.getByRole("alert").first()).toContainText(
          "orders waiting for our confirmation call",
        );
      }
    }
  });

  test("an empty bag cannot check out", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("Your bag is empty.")).toBeVisible();
  });
});
