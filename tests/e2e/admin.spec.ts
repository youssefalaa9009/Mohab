import type { APIRequestContext } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";
import { expect, test } from "./fixtures";

/** Place a cash-on-delivery order through the public API and return its number. */
async function placeOrder(request: APIRequestContext) {
  const product = await (await request.get("/api/catalog/products/organic-cotton-tee")).json();
  const variant = product.variants.find((v: { stock: string }) => v.stock !== "out");
  await request.post("/api/cart/items", { data: { variantId: variant.id, quantity: 1 } });
  const options = await (await request.get("/api/checkout/shipping?governorate=Giza")).json();
  const phone = `011${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const response = await request.post("/api/checkout", {
    data: {
      fullName: "Admin Flow Customer",
      phone,
      governorate: "Giza",
      city: "Dokki",
      line1: "5 Example Street",
      shippingRateId: options[0].id,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).number as string;
}

test.describe("admin", () => {
  test("signs in and works an order from call to delivery", async ({ page, playwright }) => {
    const customer = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const number = await placeOrder(customer);
    await customer.dispose();

    // Protected: bounces to sign-in, then back.
    await page.goto(`/admin/orders/${number}`);
    await expect(page).toHaveURL(/\/admin\/login\?next=/);

    await page.getByLabel("Email").fill(E2E_ADMIN.email);
    await page.getByLabel("Password").fill("wrong-password-here");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toContainText("don’t match");

    await page.getByLabel("Password").fill(E2E_ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: number })).toBeVisible();

    // The confirmation call.
    await page.getByRole("button", { name: "No answer" }).click();
    await expect(page.getByText("1 call so far")).toBeVisible();
    await page.getByLabel("Call note (optional)").fill("Prefers evening delivery");
    await page.getByRole("button", { name: "Confirmed", exact: true }).click();
    await expect(
      page.getByText("Customer confirmed by phone. Prefers evening delivery"),
    ).toBeVisible();

    // Fulfilment.
    await page.getByRole("button", { name: "Start packing" }).click();
    await page.getByRole("button", { name: "Mark as shipped" }).click();
    await page.getByRole("button", { name: "Mark as delivered (cash collected)" }).click();
    await expect(page.getByText("Cash collected on delivery.")).toBeVisible();
    await expect(page.getByText("Cash on delivery —")).toContainText("paid");

    // The order list exports exactly what its filters show, as a spreadsheet.
    const csv = await page.request.get(`/api/admin/orders.csv?q=${number}`);
    expect(csv.headers()["content-disposition"]).toMatch(/quattro-orders-\d{4}-\d{2}-\d{2}\.csv/);
    // trimStart() drops the byte-order mark that tells Excel the file is UTF-8.
    const rows = (await csv.text()).trimStart().split("\r\n");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain(`"${number}"`);
    expect(rows[1]).toContain('"delivered","cod","paid"');
  });

  test("customers can't reach the admin API", async ({ playwright }) => {
    const anon = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    expect((await anon.get("/api/admin/dashboard")).status()).toBe(401);

    const email = `customer-${Date.now()}@quattro.test`;
    await anon.post("/api/auth/sign-up/email", {
      data: { email, password: "customer-password-1", name: "Customer", role: "admin" },
    });
    expect((await anon.get("/api/admin/dashboard")).status()).toBe(403);
    await anon.dispose();
  });
});
