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
  test(`${name}: drawer closed waits for the panel transform`, async () => {
    const browser = await browsers[name].launch({
      timeout: 20000,
      ...(process.env.HYGULAR_BROWSER_EXECUTABLE
        ? { executablePath: process.env.HYGULAR_BROWSER_EXECUTABLE }
        : {}),
    });
    try {
      const page = await browser.newPage();
      await page.goto(base + "/tests/browser/fixture.html");
      await page.waitForFunction(() => window.api);
      const result = await page.evaluate(async () => {
        document.body.innerHTML = ["a", "b"]
          .map(
            (id) =>
              `<button id="open-${id}" data-hygular-toggle="drawer" data-target="#${id}">Open</button><div id="${id}" class="drawer"><div class="drawer-panel"><button class="drawer-close">Close</button></div></div>`,
          )
          .join("");
        const runtime = new api.Hygular();
        const a = document.querySelector("#a");
        const b = document.querySelector("#b");
        const panel = a.querySelector(".drawer-panel");
        const events = [];
        const once = (el, type) =>
          new Promise((resolve) =>
            el.addEventListener(type, resolve, { once: true }),
          );
        const opened = once(a, "hygular.drawer.opened");
        document.querySelector("#open-a").click();
        await opened;
        a.addEventListener("transitionend", (event) => {
          if (event.target === panel && event.propertyName === "transform")
            events.push("panel.end");
        });
        let runningAtClosed;
        a.addEventListener("hygular.drawer.closed", () => {
          events.push("a.closed");
          runningAtClosed = panel
            .getAnimations()
            .some((animation) => animation.playState === "running");
        });
        b.addEventListener("hygular.drawer.opened", () =>
          events.push("b.opened"),
        );
        const switched = once(b, "hygular.drawer.opened");
        document.querySelector("#open-b").click();
        await switched;
        const canceled = (event) => event.preventDefault();
        a.addEventListener("hygular.drawer.open", canceled, { once: true });
        document.querySelector("#open-a").click();
        const retainedOnCancel = b.classList.contains("is-open");
        runtime.dispose();
        return {
          events,
          runningAtClosed,
          retainedOnCancel,
          overflow: document.body.style.overflowY,
        };
      });
      assert.deepEqual(result.events, ["panel.end", "a.closed", "b.opened"]);
      assert.equal(result.runningAtClosed, false);
      assert.equal(result.retainedOnCancel, true);
      assert.equal(result.overflow, "");
    } finally {
      await browser.close();
    }
  });
  test(`${name}: duplicate delegates handle each interaction once`, async () => {
    const browser = await browsers[name].launch({
      timeout: 20000,
      ...(process.env.HYGULAR_BROWSER_EXECUTABLE
        ? { executablePath: process.env.HYGULAR_BROWSER_EXECUTABLE }
        : {}),
    });
    const fixtures = {
      dropdown:
        '<div id="target" class="dropdown"><button id="trigger" data-hygular-toggle="dropdown">Open</button><div class="dropdown-menu">Menu</div></div>',
      navbar:
        '<button id="trigger" data-hygular-toggle="navbar" data-target="#target">Open</button><div id="target" class="navbar-menu" style="display:none">Menu</div>',
      collapse:
        '<button id="trigger" data-hygular-toggle="collapse" data-target="#target">Open</button><div id="target">Content</div>',
      form: '<form id="target" data-hygular="form" data-ajax="true" action="/mock" method="post"><input name="title" value="test"><button id="trigger" type="submit">Submit</button></form>',
      alert:
        '<div id="target" data-hygular="alert"><button id="trigger" class="alert-close">Close</button></div>',
    };
    try {
      for (const [component, markup] of Object.entries(fixtures)) {
        const page = await browser.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(base + "/tests/browser/fixture.html");
          await page.waitForFunction(() => window.api);
          await page.evaluate((markup) => {
            document.body.innerHTML = markup;
            window.requestCount = 0;
            window.closedCount = 0;
            window.fetch = async () => {
              window.requestCount++;
              return new Response("{}", { status: 200 });
            };
            document.addEventListener(
              "hygular.alert.closed",
              () => window.closedCount++,
            );
            window.runtimes = [new api.Hygular(), new api.Hygular()];
          }, markup);
          await page.locator("#trigger").click();
          await page.waitForTimeout(550);
          if (component === "form") {
            assert.equal(await page.evaluate(() => window.requestCount), 1);
          } else if (component === "alert") {
            assert.equal(await page.evaluate(() => window.closedCount), 1);
            assert.equal(await page.locator("#target").count(), 0);
          } else {
            const selector = component === "navbar" ? "#trigger" : "#target";
            const className =
              component === "collapse" ? "is-open" : "is-active";
            assert.equal(
              await page
                .locator(selector)
                .evaluate((el, cls) => el.classList.contains(cls), className),
              true,
            );
            await page.locator("#trigger").click();
            await page.waitForTimeout(550);
            assert.equal(
              await page
                .locator(selector)
                .evaluate((el, cls) => el.classList.contains(cls), className),
              false,
            );
          }
          await page.evaluate(() =>
            window.runtimes.forEach((runtime) => runtime.dispose()),
          );
          assert.deepEqual(errors, []);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });

  test(`${name}: drawer removal, backdrop changes and switching release scroll`, async () => {
    const browser = await browsers[name].launch({
      timeout: 20000,
      ...(process.env.HYGULAR_BROWSER_EXECUTABLE
        ? { executablePath: process.env.HYGULAR_BROWSER_EXECUTABLE }
        : {}),
    });
    try {
      for (const scenario of ["removal", "backdrop", "switch"]) {
        const page = await browser.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(base + "/tests/browser/fixture.html");
          await page.waitForFunction(() => window.api);
          await page.evaluate(() => {
            document.body.insertAdjacentHTML(
              "afterbegin",
              `
              <button id="open-a" data-hygular-toggle="drawer" data-target="#a">Open A</button>
              <div id="a" class="drawer"><div class="drawer-panel">
                <button class="drawer-close" aria-label="Close A"></button>
                <button id="open-b" data-hygular-toggle="drawer" data-target="#b">Open B</button>
              </div></div>
              <div id="b" class="drawer"><div class="drawer-panel">
                <button class="drawer-close" aria-label="Close B"></button>
              </div></div>`,
            );
            window.runtime = new api.Hygular();
            window.opened = 0;
            document.addEventListener(
              "hygular.drawer.opened",
              () => window.opened++,
            );
          });
          await page.locator("#open-a").click();
          await page.waitForFunction(() => window.opened === 1);
          if (scenario === "removal") {
            await page.locator("#a").evaluate((el) => el.remove());
          } else if (scenario === "backdrop") {
            await page
              .locator("#a")
              .evaluate((el) => el.classList.add("has-no-backdrop"));
            await page.locator("#a .drawer-close").click();
          } else {
            await page.locator("#open-b").click();
            await page.waitForFunction(() => window.opened === 2);
            assert.equal(await page.locator(".drawer.is-open").count(), 1);
            assert.equal(
              await page
                .locator("#b")
                .evaluate((el) => el.classList.contains("is-open")),
              true,
            );
            assert.equal(
              await page.evaluate(() => document.body.style.overflowY),
              "hidden",
            );
            await page.locator("#b .drawer-close").click();
          }
          await page.waitForFunction(
            () =>
              !document.body.style.overflowY &&
              !document.documentElement.style.overflowY,
          );
          assert.equal(await page.locator(".drawer.is-open").count(), 0);
          await page.evaluate(() => window.runtime.dispose());
          assert.deepEqual(errors, []);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
  test(`${name}: duplicate runtimes release drawer scroll locks`, async () => {
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
        document.body.insertAdjacentHTML(
          "afterbegin",
          `
          <button id="drawer-trigger" data-hygular-toggle="drawer" data-target="#drawer-test">Open</button>
          <div id="drawer-test" class="drawer">
            <div class="drawer-panel"><button class="drawer-close" aria-label="Close"></button></div>
          </div>`,
        );
        window.runtimes = [new api.Hygular(), new api.Hygular()];
        window.drawerEvents = { opened: 0, closed: 0 };
        const drawer = document.querySelector("#drawer-test");
        for (const name of Object.keys(window.drawerEvents)) {
          drawer.addEventListener(
            `hygular.drawer.${name}`,
            () => window.drawerEvents[name]++,
          );
        }
      });
      let cycles = 0;
      for (const action of ["button", "escape", "backdrop"]) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.locator("#drawer-trigger").click();
        await page.waitForFunction(
          (count) => window.drawerEvents.opened === count,
          ++cycles,
        );
        assert.equal(
          await page.evaluate(() => document.body.style.overflowY),
          "hidden",
        );
        if (action === "button")
          await page.locator("#drawer-test .drawer-close").click();
        else if (action === "escape") await page.keyboard.press("Escape");
        else await page.mouse.click(900, 400);
        await page.waitForFunction(
          (count) => window.drawerEvents.closed === count,
          cycles,
        );
        assert.deepEqual(
          await page.evaluate(() => [
            document.body.style.overflowY,
            document.documentElement.style.overflowY,
            document
              .querySelector("#drawer-test")
              .classList.contains("is-open"),
          ]),
          ["", "", false],
        );
        await page.waitForFunction(
          () =>
            getComputedStyle(document.querySelector("#drawer-test"))
              .visibility === "hidden",
        );
        await page.mouse.move(600, 400);
        await page.mouse.wheel(0, 250);
        await page.waitForFunction(() => window.scrollY > 0);
      }
      await page.evaluate(() =>
        window.runtimes.forEach((runtime) => runtime.dispose()),
      );
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
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
