import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";
const directory = resolve(fileURLToPath(new URL("../../", import.meta.url)));
let server, base;
before(async () => {
  server = createServer(async (request, response) => {
    try {
      const path = resolve(
        directory,
        "." + new URL(request.url, "http://localhost").pathname,
      );
      if (!path.startsWith(directory + sep)) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader(
        "Content-Type",
        { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" }[
          extname(path)
        ] || "text/plain",
      );
      response.end(await readFile(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((done) => server.close(done));
});
const browsers = { chromium, firefox, webkit };
const selected =
  process.env.HYGULAR_BROWSERS?.split(",") || Object.keys(browsers);
for (const name of selected) {
  test(`${name}: select keyboard, modal focus, responsive CSS and scroll-lock geometry`, async () => {
    assert.ok(browsers[name], `Unknown browser: ${name}`);
    const browser = await browsers[name].launch({
      timeout: 20000,
      ...(process.env.HYGULAR_BROWSER_EXECUTABLE
        ? { executablePath: process.env.HYGULAR_BROWSER_EXECUTABLE }
        : {}),
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1024, height: 768 },
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + "/tests/browser/fixture.html");
      await page.waitForFunction(() => window.api);
      await page.evaluate(() => {
        window.select = new api.Select(document.querySelector("#select"), {
          data: [
            { value: 0, name: "Zero" },
            { value: 1, name: "One" },
          ],
        });
      });
      await page.locator(".selected-option").focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("#select").inputValue(), "1");
      const shifts = await page.evaluate(async () => {
        const { default: ScrollLock } =
          await import("/src/js/utils/ScrollLock.js");
        const nodes = ["#content", "#fixed", "#sticky"].map((id) =>
          document.querySelector(id),
        );
        const measure = () =>
          nodes.map((node) => {
            const r = node.getBoundingClientRect();
            return [r.left, r.right];
          });
        const before = measure(),
          first = new ScrollLock(),
          second = new ScrollLock();
        const width = first.getScrollbarWidth();
        first.lock();
        second.lock();
        first.unlock();
        const during = measure();
        second.unlock();
        const after = measure();
        return { before, during, after, width };
      });
      for (let i = 0; i < shifts.before.length; i++)
        for (let edge = 0; edge < 2; edge++) {
          assert.ok(
            Math.abs(shifts.before[i][edge] - shifts.during[i][edge]) <= 1,
            `${name}: locked element ${i} shifted`,
          );
          assert.ok(
            Math.abs(shifts.before[i][edge] - shifts.after[i][edge]) <= 1,
            `${name}: unlocked element ${i} shifted`,
          );
        }
      await page.locator(".selected-option").focus();
      await page.evaluate(() => {
        window.dialogResult = api.Modal.confirm({
          heading: "Confirm",
          content: "Continue?",
        });
      });
      await page.locator(".modal-confirm").waitFor({ state: "visible" });
      // Do not manually focus a modal child until initial focus is verified.
      await page.waitForFunction(
        () =>
          document.activeElement === document.querySelector(".modal-dialog"),
      );
      await page.locator(".modal-confirm").focus();
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator(".modal-close")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await page.locator(".modal-confirm").click();
      assert.equal(await page.evaluate(() => dialogResult), true);
      assert.equal(await page.locator(".modal").count(), 0);
      assert.equal(
        await page
          .locator(".selected-option")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      await page.evaluate(() => {
        document.body.insertAdjacentHTML(
          "beforeend",
          '<div id="beta-carousel" class="carousel" style="width:400px"><div class="carousel-items"><div class="item" style="height:120px">One</div><div class="item" style="height:120px">Two</div></div></div>',
        );
        window.betaCarousel = api.Carousel.create("#beta-carousel", {
          autoplay: { enabled: false },
        });
      });
      const pager = page.locator("#beta-carousel .pager button").nth(1);
      await pager.focus();
      await page.keyboard.press("Enter");
      assert.equal(await pager.getAttribute("aria-current"), "true");
      await page.evaluate(() => {
        window.betaCarousel.dispose();
        window.betaRuntime = new api.Hygular();
        document.body.insertAdjacentHTML(
          "beforeend",
          '<button id="beta-popover" data-hygular-toggle="popover" data-content="Details">Details</button>',
        );
      });
      await page.locator("#beta-popover").scrollIntoViewIfNeeded();
      await page.waitForFunction(() =>
        api.Popover.getInstance(document.querySelector("#beta-popover")),
      );
      await page.locator("#beta-popover").click();
      await page.waitForSelector(".popover.is-open");
      await page.evaluate(() => window.betaRuntime.dispose());
      // Check both sides of the breakpoint using the browser's layout viewport.
      for (const [width, display] of [
        [500, "none"],
        [1200, "block"],
        [500, "none"],
      ]) {
        await page.setViewportSize({ width, height: 768 });
        try {
          await page.waitForFunction(
            ({ display }) => {
              const element = document.querySelector("#responsive");
              const aboveBreakpoint = matchMedia("(min-width: 864px)").matches;
              return (
                element !== null &&
                aboveBreakpoint === (display === "block") &&
                getComputedStyle(element).display === display
              );
            },
            { display },
            { timeout: 5000 },
          );
        } catch (cause) {
          const state = await page.evaluate(() => {
            const element = document.querySelector("#responsive");
            return {
              viewport: window.innerWidth,
              breakpointMatches: matchMedia("(min-width: 864px)").matches,
              display: element ? getComputedStyle(element).display : null,
              classes: element?.className,
            };
          });
          throw new Error(
            `${name}: responsive check failed at requested width ${width}; ` +
              `expected ${display}; observed ${JSON.stringify(state)}`,
            { cause },
          );
        }
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
}
