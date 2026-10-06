import type { Page } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";
import { expect, hydrated, test } from "./fixtures";

const ADDRESS = "e2e-store@instapay";

const field = (page: Page, label: string) =>
  page.getByRole("main").getByLabel(label, { exact: true });

const reference = () => `E2E${Date.now()}${Math.floor(Math.random() * 1e4)}`;

async function signInAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/admin");
}

/**
 * InstaPay settings are store-wide: run these one at a time. Both projects only
 * ever switch it on with the same values; global teardown removes it.
 */
test.describe.configure({ mode: "serial" });

test.describe("InstaPay", () => {
  test("staff configure it, a shopper pays, staff verify", async ({ page, browser }) => {
    test.slow();
    // ── Staff switch InstaPay on ───────────────────────────────────────────
    await signInAdmin(page);
    await page.goto("/admin/payments");
    await hydrated(page);
    const enable = page.getByLabel("Offer InstaPay at checkout");
    await page.getByLabel("InstaPay address (IPA)").fill("");
    await enable.check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert")).toContainText("Add the InstaPay address");

    await page.getByLabel("InstaPay address (IPA)").fill(ADDRESS);
    await page.getByLabel("Account name customers will see").fill("E2E Store");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved.");

    // ── A shopper orders with InstaPay ─────────────────────────────────────
    const shopperContext = await browser.newContext({ baseURL: "http://localhost:3000" });
    const shopper = await shopperContext.newPage();
    await shopper.goto("/products/organic-cotton-tee");
    await hydrated(shopper);
    const size = shopper.locator('label:has(input[name="size"]:not([disabled]))').first();
    if (await size.count()) await size.click();
    await shopper.getByRole("button", { name: "Add to bag" }).click();
    await expect(shopper.getByRole("dialog")).toBeVisible();

    await shopper.goto("/checkout");
    await hydrated(shopper);
    const phone = `015${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await field(shopper, "Mobile number").fill(phone);
    await field(shopper, "Email (optional)").fill("instapay-shopper@quattro.test");
    await field(shopper, "Full name").fill("InstaPay Shopper");
    await field(shopper, "Governorate").selectOption("Cairo");
    await field(shopper, "City / area").fill("Heliopolis");
    await field(shopper, "Street address").fill("3 Example Street");
    await expect(shopper.getByRole("radio", { name: /Standard delivery/ })).toBeChecked();
    await shopper.getByRole("radio", { name: /InstaPay/ }).check();
    await shopper.getByRole("button", { name: /Place order/ }).click();

    await expect(shopper.getByRole("heading", { name: "Pay with InstaPay" })).toBeVisible();
    await expect(shopper.getByText(ADDRESS)).toBeVisible();
    // The customer is told the deadline before the order is auto-cancelled.
    await expect(
      shopper.getByText(/Please pay by .+\. After that the order is cancelled/),
    ).toBeVisible();
    const number = (await shopper.getByText(/^Order Q-\d+$/).textContent())!.replace("Order ", "");

    await field(shopper, "Transaction reference").fill("no");
    await shopper.getByRole("button", { name: "Send reference" }).click();
    await expect(
      shopper.getByText("Enter the transaction reference from your banking app."),
    ).toBeVisible();

    const first = reference();
    await field(shopper, "Transaction reference").fill(first);
    await shopper.getByRole("button", { name: "Send reference" }).click();
    await expect(shopper.getByRole("status")).toContainText("we’re checking your transfer");

    // ── Staff can't find it: the shopper is asked to resend ───────────────
    await page.goto("/admin");
    await expect(page.getByText(/InstaPay transfers? to verify/)).toBeVisible();
    await page.goto(`/admin/orders/${number}`);
    await hydrated(page);
    await expect(page.getByText(first).first()).toBeVisible();
    // No plain "Confirmed" shortcut: payment orders are confirmed by verifying.
    await expect(page.getByRole("button", { name: "Confirmed", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Not found" }).click();
    await expect(page.getByText("The last reference couldn’t be verified")).toBeVisible();

    await shopper.reload();
    await hydrated(shopper);
    await expect(shopper.getByText("We couldn’t verify the last reference")).toBeVisible();
    const second = reference();
    await field(shopper, "Transaction reference").fill(second);
    await shopper.getByRole("button", { name: "Send reference" }).click();
    await expect(shopper.getByRole("status")).toContainText(second);

    // ── Staff verify: paid and confirmed ──────────────────────────────────
    await page.reload();
    await hydrated(page);
    await page.getByRole("button", { name: "Payment received" }).click();
    await expect(page.getByText("paid", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: number })).toBeVisible();

    await shopper.reload();
    await expect(shopper.getByText(/InstaPay payment of .* received/)).toBeVisible();

    // A reference can pay only one order.
    const tracked = await shopper.request.post("/api/orders/track", {
      data: { number, phone },
    });
    expect((await tracked.json()).status).toBe("confirmed");
    await shopperContext.close();
  });

  test("a used reference can't pay a second order", async ({ page, playwright }) => {
    await signInAdmin(page);
    await page.request.put("/api/admin/payment-settings", {
      data: { instapay: { enabled: true, address: ADDRESS, accountName: "E2E Store", note: "" } },
    });

    const placeOrder = async () => {
      const shopper = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
      const product = await (await shopper.get("/api/catalog/products/organic-cotton-tee")).json();
      const variant = product.variants.find((v: { stock: string }) => v.stock !== "out");
      await shopper.post("/api/cart/items", { data: { variantId: variant.id, quantity: 1 } });
      const options = await (await shopper.get("/api/checkout/shipping?governorate=Giza")).json();
      const placed = await shopper.post("/api/checkout", {
        data: {
          fullName: "Duplicate Ref",
          phone: `012${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
          governorate: "Giza",
          city: "Dokki",
          line1: "5 Example Street",
          shippingRateId: options[0].id,
          paymentMethod: "instapay",
        },
      });
      expect(placed.status()).toBe(201);
      const body = await placed.json();
      return { shopper, ...body } as { shopper: typeof shopper; number: string; accessKey: string };
    };

    const a = await placeOrder();
    const b = await placeOrder();
    const shared = reference();
    const first = await a.shopper.post(`/api/orders/${a.number}/instapay`, {
      data: { key: a.accessKey, reference: shared },
    });
    expect(first.status()).toBe(200);
    const second = await b.shopper.post(`/api/orders/${b.number}/instapay`, {
      data: { key: b.accessKey, reference: shared },
    });
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toContain("already been used");

    // Wrong key: indistinguishable from a missing order.
    const forged = await b.shopper.post(`/api/orders/${b.number}/instapay`, {
      data: { key: "nope", reference: reference() },
    });
    expect(forged.status()).toBe(404);
    await a.shopper.dispose();
    await b.shopper.dispose();
  });
});
