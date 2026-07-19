import { expect, test } from "@playwright/test";

test("public landing and authentication routes are available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Shared expenses, settled fairly." })).toBeVisible();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByText("Create your account")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
});

test("protected application routes redirect anonymous visitors", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByText("Welcome back")).toBeVisible();
});

test("receipt downloads do not reveal existence to anonymous visitors", async ({ request }) => {
  const response = await request.get("/api/attachments/cmdoesnotexist00000000001");
  expect(response.status()).toBe(404);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});
