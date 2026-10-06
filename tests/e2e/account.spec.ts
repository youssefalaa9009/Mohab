import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const PASSWORD = "e2e-shopper-password";

/** Form fields in the page body — the footer has its own newsletter email field. */
const field = (page: Page, label: string) =>
  page.getByRole("main").getByLabel(label, { exact: true });

function randomPhone() {
  return `011${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}

/** A fresh account per test; `npm run test:e2e` setup removes them afterwards. */
async function register(page: Page, name = "E2E Shopper") {
  const email = `e2e-shopper-${Date.now()}-${Math.floor(Math.random() * 1e6)}@quattro.test`;
  await page.goto("/account/register");
  await field(page, "Full name").fill(name);
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: `Hello, ${name.split(" ")[0]}` })).toBeVisible();
  return email;
}

async function signIn(page: Page, email: string, password: string, next = "") {
  await page.goto(`/account/login${next}`);
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("customer accounts", () => {
  test("orders placed while signed in land in the account, with the address saved", async ({
    page,
  }) => {
    const email = await register(page);
    await expect(page.getByText("No orders yet.")).toBeVisible();

    await page.goto("/products/loopback-hoodie");
    await page.locator('label:has(input[name="size"][value="M"])').click();
    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.goto("/checkout");
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    await expect(field(page, "Email (optional)")).toHaveValue(email);
    await expect(field(page, "Full name")).toHaveValue("E2E Shopper");

    const phone = randomPhone();
    await field(page, "Mobile number").fill(phone);
    await field(page, "Governorate").selectOption("Giza");
    await field(page, "City / area").fill("Dokki");
    await field(page, "Street address").fill("7 Example Street");
    await expect(field(page, "Save this address to my account")).toBeChecked();
    await expect(page.getByRole("radio", { name: /Standard delivery/ })).toBeChecked();
    await page.getByRole("button", { name: /Place order/ }).click();

    await expect(
      page.getByRole("heading", { name: "Thank you — your order is in." }),
    ).toBeVisible();
    const number = (await page.getByText(/^Order Q-\d+$/).textContent())!.replace("Order ", "");

    // The order is in the account, and opens without the confirmation key.
    await page.goto("/account/orders");
    await page.getByRole("link", { name: new RegExp(number) }).click();
    await expect(page.getByRole("heading", { name: number })).toBeVisible();
    await expect(page.getByText("7 Example Street")).toBeVisible();

    await page.goto("/account/addresses");
    await expect(page.getByText("Dokki, Giza")).toBeVisible();
    await expect(page.getByText("Default", { exact: true })).toBeVisible();

    // Next checkout starts from the saved address, delivery options already loaded.
    await page.goto("/products/loopback-hoodie");
    await page.locator('label:has(input[name="size"][value="M"])').click();
    await page.getByRole("button", { name: "Add to bag" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.goto("/checkout");
    await expect(field(page, "Governorate")).toHaveValue("Giza");
    await expect(field(page, "Street address")).toHaveValue("7 Example Street");
    await expect(field(page, "Mobile number")).toHaveValue(phone);
    await expect(page.getByRole("radio", { name: /Standard delivery/ })).toBeChecked();
    await expect(field(page, "Save this address to my account")).toHaveCount(0);
  });

  test("manages addresses", async ({ page }) => {
    await register(page);
    await page.goto("/account/addresses");
    // No addresses yet: the form is already open.
    await field(page, "Full name").fill("E2E Shopper");
    await field(page, "Mobile number").fill("not a phone");
    await field(page, "Governorate").selectOption("Alexandria");
    await field(page, "City / area").fill("Smouha");
    await field(page, "Street address").fill("3 Example Road");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Enter an Egyptian mobile number").first()).toBeVisible();

    await field(page, "Mobile number").fill("012 3456 7890");
    await field(page, "Label (optional, e.g. Home)").fill("Home");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Smouha, Alexandria")).toBeVisible();
    await expect(page.getByText("01234567890")).toBeVisible();

    await page.getByRole("button", { name: "Edit" }).click();
    await field(page, "City / area").fill("Sporting");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Sporting, Alexandria")).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Sporting, Alexandria")).toHaveCount(0);
  });

  test("updates details, changes the password and signs back in", async ({ page }) => {
    const email = await register(page);
    await page.goto("/account/settings");

    await field(page, "Full name").fill("E2E Renamed");
    await field(page, "Mobile number").fill("010 0000 0001");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hello, E2E" })).toBeVisible();

    await field(page, "Current password").fill("wrong-password-123");
    await field(page, "New password").fill("e2e-new-password-1");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("alert")).toHaveText("Your current password isn’t right.");

    await field(page, "Current password").fill(PASSWORD);
    await field(page, "New password").fill("e2e-new-password-1");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Password changed." })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");

    await signIn(page, email, PASSWORD);
    await expect(page.getByRole("alert")).toHaveText("That email and password don’t match.");
    await signIn(page, email, "e2e-new-password-1");
    await expect(page.getByRole("heading", { name: "Hello, E2E" })).toBeVisible();
  });

  test("guards the account area and its API", async ({ page, request }) => {
    await page.goto("/account/orders");
    await expect(page).toHaveURL("/account/login?next=%2Faccount%2Forders");

    expect((await request.get("/api/account/orders")).status()).toBe(401);
    expect((await request.get("/api/account/checkout-defaults")).status()).toBe(401);

    // Signed-out checkout offers sign-in rather than requiring it.
    await page.goto("/checkout");
    await expect(page.getByText("Your bag is empty.")).toBeVisible();

    // ?next= never leaves the site.
    const email = await register(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
    await signIn(page, email, PASSWORD, "?next=%2F%5Cevil.example");
    await expect(page).toHaveURL("/account");

    // Another customer's order number reads as missing.
    expect((await page.request.get("/api/account/orders/Q-100000")).status()).toBe(404);

    await page.goto("/account/forgot-password");
    await field(page, "Email").fill("nobody@quattro.test");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists for that email");

    await page.goto("/account/reset-password?token=bogus");
    await field(page, "New password").fill("e2e-new-password-2");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("alert")).toContainText("expired or was already used");
  });
});
