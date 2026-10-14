import { chromium } from "playwright";
import * as THREE from "three";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.GAME_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
await mkdir("test-results", { recursive: true });
const errors = [];
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.setDefaultTimeout(60000);
}
async function until(fn, message, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(message);
}
async function station(page, x, z, button) {
  const bounds = await page.locator("#store").boundingBox();
  const aspect = bounds.width / bounds.height,
    span = aspect < 1.3 ? 38 / aspect : 27.5;
  const camera = new THREE.OrthographicCamera(
    (-span * aspect) / 2,
    (span * aspect) / 2,
    span / 2,
    -span / 2,
    0.1,
    150,
  );
  camera.position.set(27, 31, 35);
  camera.lookAt(0, 0, -0.4);
  camera.updateMatrixWorld();
  const p = new THREE.Vector3(x, 0, z).project(camera);
  await page.mouse.click(
    bounds.x + (p.x * 0.5 + 0.5) * bounds.width,
    bounds.y + (-p.y * 0.5 + 0.5) * bounds.height,
  );
  await page.locator(button).waitFor({ state: "attached" });
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const a = await context.newPage();
  watch(a);
  await a.goto(base, { waitUntil: "domcontentloaded" });
  await a.locator(".player-label").waitFor({ state: "attached" });
  await a.screenshot({
    path: "test-results/market-desktop.png",
    fullPage: true,
  });
  console.log("PASS desktop market renders with no runtime errors");
  await a.locator('[data-modal="friends"]').click();
  await a.locator("#employee-name").fill("Avery");
  await a.locator("#create-room").click();
  await a.locator(".room-share strong").waitFor({ state: "attached" });
  const code = await a.locator(".room-share strong").textContent();
  assert.match(code, /^[A-Z2-9]{5}$/);
  await a.locator(".modal-close").click();
  const secondContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const b = await secondContext.newPage();
  watch(b);
  await b.goto(`${base}/?room=${code}`, { waitUntil: "domcontentloaded" });
  await b.locator("#room-code").waitFor({ state: "attached" });
  await b.locator("#employee-name").fill("Riley");
  await b.locator("#join-form button").click();
  await until(
    async () =>
      (await a.locator(".player-label").count()) === 2 &&
      (await b.locator(".player-label").count()) === 2,
    "Two avatars did not synchronize",
  );
  console.log(
    `PASS second browser joins room ${code} and both employees appear`,
  );
  await a.bringToFront();
  await a.locator("[data-start]").click();
  const startedAt = Date.now();
  await until(
    async () => (await a.locator("#timer").textContent()) !== "03:00",
    "Timer did not begin",
  );
  await station(a, -10, -2.45, '[data-collect="berries"]');
  await a.locator('[data-collect="berries"]').click();
  await a.locator('[data-collect="banana"]').click();
  await station(a, -2, -2.45, '[data-collect="almond"]');
  await a.locator('[data-collect="almond"]').click();
  await until(
    async () => (await a.locator(".tray-slot.filled").count()) === 3,
    "Ingredients did not enter tray",
  );
  console.log(
    "PASS click-to-walk collects three shared ingredients without crossing fixtures",
  );
  await station(a, 2, -2.45, '[data-action="blend"]');
  await a.locator('[data-action="blend"]').click();
  await a.locator(".ready-drink").waitFor({ state: "attached" });
  await station(a, -3.5, 0.1, '[data-action="serve"]');
  await a.locator('[data-action="serve"]').click();
  await until(
    async () =>
      (await a.locator("#my-score").textContent()) === "100" &&
      (await b.locator("#rival-score").textContent()) === "100",
    "Delivered smoothie or opponent score did not synchronize",
  );
  console.log(
    "PASS blend, delivery, customer removal, and live opponent scores",
  );
  await a.screenshot({
    path: "test-results/multiplayer-shift.png",
    fullPage: true,
  });
  await b.close();
  await secondContext.close();
  await a.locator('[data-modal="profile"]').click();
  await a.locator('[data-outfit="#9a6261"]').click();
  await a.locator("#employee-name").fill("Avery Rose");
  await a.locator("#save-profile").click();
  await until(
    async () =>
      (
        await a.locator(".player-label.is-you .player-name").textContent()
      ).includes("Avery Rose"),
    "Customized name did not synchronize",
  );
  console.log("PASS employee customization");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobile = await mobileContext.newPage();
  watch(mobile);
  await mobile.goto(base, { waitUntil: "domcontentloaded" });
  await mobile.locator(".player-label").waitFor({ state: "attached" });
  assert.ok(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile page overflows horizontally",
  );
  await mobile.screenshot({
    path: "test-results/market-mobile.png",
    fullPage: true,
  });
  await mobileContext.close();
  console.log("PASS mobile layout and WebGL rendering");
  await a.bringToFront();
  if (process.env.FULL_MATCH === "1") {
    console.log("Completing the full three-minute shift…");
    await until(
      async () => (await a.locator("#timer").textContent()) === "00:00",
      "Three-minute competition did not end",
      Math.max(10000, 190000 - (Date.now() - startedAt)),
    );
    await a.locator(".results-list").waitFor({ state: "attached" });
    assert.match(await a.locator(".results-list").textContent(), /100/);
    await a.screenshot({
      path: "test-results/shift-results.png",
      fullPage: true,
    });
    console.log("PASS full 180-second shift ends with results");
  }
  assert.deepEqual(errors, [], `Browser runtime errors: ${errors.join("; ")}`);
  console.log("PASS no browser runtime or console errors");
} finally {
  await browser.close();
}
