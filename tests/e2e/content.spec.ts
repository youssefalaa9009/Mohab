import type { Page } from "@playwright/test";
import { E2E_ADMIN } from "./global-setup";
import { expect, test } from "./fixtures";

const field = (page: Page, label: string) =>
  page.getByRole("main").getByLabel(label, { exact: true });

async function adminSignIn(page: Page, path: string) {
  await page.goto(`/admin/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(path);
}

test.describe("content pages", () => {
  test("help, brand and legal pages render", async ({ page }) => {
    for (const [path, heading] of [
      ["/about", "Made to be worn, again and again."],
      ["/faq", "FAQ"],
      ["/help/shipping", "Shipping"],
      ["/help/returns", "Returns & exchanges"],
      ["/legal/privacy", "Privacy policy"],
      ["/legal/terms", "Terms & conditions"],
      ["/legal/cookies", "Cookie policy"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    await page.goto("/faq");
    await page.getByText("How can I pay?").click();
    await expect(page.getByText("Cash on delivery: you pay in cash")).toBeVisible();

    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/help/track-order</loc>");
  });

  test("contact form validates, sends, and lands in the admin inbox", async ({ page }) => {
    const subject = `E2E question ${Date.now()}`;
    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toHaveText("Please check the highlighted fields.");
    await expect(field(page, "Name")).toBeFocused();

    await field(page, "Name").fill("E2E Visitor");
    await field(page, "Email").fill("visitor@quattro.test");
    await field(page, "Subject").fill(subject);
    await field(page, "Message").fill("Do you restock sold-out sizes?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("status")).toContainText("your message is in");

    await adminSignIn(page, "/admin/messages");
    const card = page.getByRole("listitem").filter({ hasText: subject });
    await expect(card).toContainText("Do you restock sold-out sizes?");
    await card.getByRole("button", { name: "Mark handled" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: subject })).toHaveCount(0);
    await page.getByLabel("Show handled").check();
    await expect(page.getByRole("listitem").filter({ hasText: subject })).toBeVisible();
  });

  test("newsletter signup reaches the subscriber list and export", async ({ page }) => {
    const email = `e2e-news-${Date.now()}@quattro.test`;
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await footer.getByLabel("Email address").fill("not-an-email");
    await footer.getByRole("button", { name: "Subscribe" }).click();
    await expect(footer.getByRole("alert")).toHaveText("Enter a valid email address.");
    await footer.getByLabel("Email address").fill(email);
    await footer.getByRole("button", { name: "Subscribe" }).click();
    await expect(footer.getByRole("status")).toHaveText("You’re on the list. Thank you.");

    await adminSignIn(page, "/admin/newsletter");
    await expect(page.getByRole("cell", { name: email })).toBeVisible();
    const csv = await (await page.request.get("/api/admin/subscribers.csv")).text();
    expect(csv).toContain(`"${email}","footer"`);

    page.once("dialog", (dialog) => void dialog.accept());
    await page
      .getByRole("row")
      .filter({ hasText: email })
      .getByRole("button", { name: "Unsubscribe" })
      .click();
    await expect(page.getByRole("row").filter({ hasText: email })).toContainText("Unsubscribed");
    const after = await (await page.request.get("/api/admin/subscribers.csv")).text();
    expect(after).not.toContain(email);
  });

  test("the signed link in the newsletter unsubscribes that address only", async ({ page }) => {
    const email = `e2e-news-${Date.now()}-link@quattro.test`;
    await page.request.post("/api/content/newsletter", { data: { email } });
    await adminSignIn(page, "/admin/newsletter");
    const csv = await (await page.request.get("/api/admin/subscribers.csv")).text();
    const line = csv.split("\r\n").find((row) => row.includes(email))!;
    const link = new URL(line.split(",")[3]!.replaceAll('"', ""));

    // A token for one address is useless for another.
    const forged = await page.request.post("/api/content/newsletter/unsubscribe", {
      data: { email: "someone-else@quattro.test", token: link.searchParams.get("token") },
    });
    expect(forged.status()).toBe(400);

    // Opening the link alone changes nothing (mail scanners open links): it takes a click.
    await page.goto(link.pathname + link.search);
    await expect(page.getByText(`Stop sending the QUATTRO newsletter to ${email}?`)).toBeVisible();
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(page.getByRole("status")).toContainText("You’re unsubscribed.");
    const after = await (await page.request.get("/api/admin/subscribers.csv")).text();
    expect(after).not.toContain(email);
  });

  test("track order finds an order by number and phone", async ({ page, playwright }) => {
    // Place an order as a separate shopper through the public API.
    const shopper = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const product = await (await shopper.get("/api/catalog/products/organic-cotton-tee")).json();
    const variant = product.variants.find((v: { stock: string }) => v.stock !== "out");
    await shopper.post("/api/cart/items", { data: { variantId: variant.id, quantity: 1 } });
    const options = await (await shopper.get("/api/checkout/shipping?governorate=Cairo")).json();
    const phone = `012${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    const placed = await shopper.post("/api/checkout", {
      data: {
        fullName: "Tracking Customer",
        phone,
        governorate: "Cairo",
        city: "Maadi",
        line1: "9 Example Street",
        shippingRateId: options[0].id,
      },
    });
    const { number } = await placed.json();
    await shopper.dispose();

    await page.goto("/help/track-order");
    await field(page, "Order number").fill(number);
    await field(page, "Mobile number").fill("010 0000 0000");
    await page.getByRole("button", { name: "Track order" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "We couldn’t find an order with those details.",
    );

    await field(page, "Order number").fill(number.toLowerCase());
    await field(page, "Mobile number").fill(phone);
    await page.getByRole("button", { name: "Track order" }).click();
    await expect(page.getByRole("heading", { name: "Order received" })).toBeVisible();
    await expect(page.getByText("We’ll call you to confirm it before it ships.")).toBeVisible();
    await expect(page.getByText("9 Example Street")).toBeVisible();
  });
});
