import { expect, test } from "@playwright/test";

test("does not flash the procedural fallback while the mesh model is loading", async ({ page }) => {
  let releaseModelRequest;
  const modelRequestReleased = new Promise((resolve) => {
    releaseModelRequest = resolve;
  });

  await page.route("**/models/libertystatue.glb", async (route) => {
    await modelRequestReleased;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__libertyDebug?.getParticleSource() === "loading");

  await expect(page.locator("#state-label")).toHaveText("Loading scan");
  expect(await page.evaluate(() => window.__libertyDebug.getParticleCount())).toBe(0);
  expect(await page.evaluate(() => window.__libertyDebug.isParticleVisible())).toBe(false);

  releaseModelRequest();
  await page.waitForFunction(() => window.__libertyDebug?.getParticleSource() === "mesh");
  await page.waitForFunction(() => window.__libertyDebug?.isParticleVisible() === true);
});

test("renders the particle statue and toggles between states", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Liberty Particles" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForFunction(() => window.__libertyDebug?.getParticleSource() === "mesh");
  await page.waitForFunction(() => window.__libertyDebug?.getParticleCount() >= 45000);
  await page.waitForFunction(() => window.__libertyDebug?.getQualityMode() === "auto");
  await page.waitForFunction(() => document.body.dataset.celebration === "america250");
  await page.waitForFunction(() => window.__libertyDebug?.getIntroLabel() === "1776");
  await page.waitForFunction(() => window.__libertyDebug?.getActiveFireworks() > 0);
  await expect(page.locator("#state-label")).toHaveText("Assembled");

  await page.waitForTimeout(800);
  const initialPixelCount = await countLitCanvasPixels(page);
  expect(initialPixelCount).toBeGreaterThan(600);

  await page.mouse.click(900, 420);
  await expect(page.locator("#state-label")).toHaveText("Disintegrated");
  await page.waitForFunction(() => window.__libertyDebug?.getTransition() > 0.8);

  await page.mouse.click(900, 420);
  await expect(page.locator("#state-label")).toHaveText("Assembled");
  await page.waitForFunction(() => window.__libertyDebug?.getTransition() < 0.2);
});

test("changes particle quality without toggling the statue and persists the selection", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__libertyDebug?.getParticleSource() === "mesh");

  await page.getByRole("button", { name: "Performance" }).click();

  await page.waitForFunction(() => window.__libertyDebug?.getQualityMode() === "performance");
  await page.waitForFunction(() => window.__libertyDebug?.isResamplingMesh() === false);
  await page.waitForFunction(() => window.__libertyDebug?.getParticleCount() === 45000);
  await expect(page.locator("#state-label")).toHaveText("Assembled");
  await expect(page.getByRole("button", { name: "Performance" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("liberty-particle-quality"))).toBe("performance");
  expect(await page.evaluate(() => window.__libertyDebug.isDisintegrated())).toBe(false);

  await page.reload();

  await expect(page.getByRole("button", { name: "Performance" })).toHaveAttribute("aria-pressed", "true");
  await page.waitForFunction(() => window.__libertyDebug?.getParticleSource() === "mesh");
  await page.waitForFunction(() => window.__libertyDebug?.getParticleCount() === 45000);
});

test("fits the interface on a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const heading = page.getByRole("heading", { name: "Liberty Particles" });
  const button = page.getByRole("button", { name: "Toggle particle disintegration" });
  const qualityControl = page.getByRole("group", { name: "Particle quality" });

  await expect(heading).toBeVisible();
  await expect(button).toBeVisible();
  await expect(qualityControl).toBeVisible();

  const headingBox = await heading.boundingBox();
  const buttonBox = await button.boundingBox();
  const qualityBox = await qualityControl.boundingBox();
  expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(390);
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(390);
  expect(qualityBox.x + qualityBox.width).toBeLessThanOrEqual(390);
});

async function countLitCanvasPixels(page) {
  return page.locator("#liberty-canvas").evaluate((canvas) => {
    const context = canvas.getContext("2d");

    if (context) {
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let lit = 0;

      for (let index = 0; index < data.length; index += 80) {
        if (data[index] + data[index + 1] + data[index + 2] > 40) {
          lit += 1;
        }
      }

      return lit;
    }

    return canvas.toDataURL("image/png").length;
  });
}
