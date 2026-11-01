import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Components from "../src/js/core/Component.js";
import ScrollLock from "../src/js/utils/ScrollLock.js";
import { createDOM, wait, endTransition, key } from "./helpers/dom.js";

const markup = `
  <button id="trigger" data-hygular-toggle="drawer" data-target="#drawer">Open</button>
  <div id="drawer" class="drawer">
    <div class="drawer-panel"><button class="drawer-close">Close</button></div>
  </div>`;
let dom, drawer, disposers;

beforeEach(() => {
  dom = createDOM(markup);
  drawer = document.querySelector("#drawer");
  disposers = [];
});

afterEach(() => {
  disposers.reverse().forEach((dispose) => dispose());
  const errors = [...dom.errors];
  dom.close();
  assert.deepEqual(errors, []);
});

function bind() {
  const dispose = Components.drawer();
  disposers.push(dispose);
  return dispose;
}

function open() {
  document.querySelector("#trigger").click();
  dom.flushFrames();
  assert.equal(drawer.classList.contains("is-open"), true);
}

function close() {
  drawer.querySelector(".drawer-close").click();
  endTransition(drawer.querySelector(".drawer-panel"), "transform");
}

function assertUnlocked() {
  for (const element of [document.body, document.documentElement]) {
    assert.equal(element.style.overflowX, "");
    assert.equal(element.style.overflowY, "");
  }
}

for (const action of ["button", "escape", "backdrop"]) {
  test(`duplicate drawer registrations release scroll on ${action} dismissal`, () => {
    bind();
    bind();
    open();
    assert.equal(document.body.style.overflowY, "hidden");
    if (action === "button") drawer.querySelector(".drawer-close").click();
    else if (action === "escape") key(document, "Escape");
    else drawer.click();
    endTransition(drawer.querySelector(".drawer-panel"), "transform");
    assert.equal(drawer.classList.contains("is-open"), false);
    assertUnlocked();
  });
}

test("drawer close releases scroll when no transition event is emitted", async () => {
  bind();
  bind();
  open();
  drawer.querySelector(".drawer-close").click();
  await wait(500);
  assertUnlocked();
});

test("subscription cleanup is idempotent and preserves remaining subscribers", () => {
  const first = bind();
  bind();
  open();
  first();
  first();
  assert.equal(drawer.classList.contains("is-open"), true);
  assert.equal(document.body.style.overflowY, "hidden");
  close();
  assertUnlocked();
});

test("final subscription cleanup cancels pending work and allows reinitialization", async () => {
  const first = bind();
  const second = bind();
  let opened = 0;
  drawer.addEventListener("hygular.drawer.opened", () => opened++);
  document.querySelector("#trigger").click();
  first();
  second();
  dom.flushFrames();
  await wait(500);
  assert.equal(opened, 0);
  assert.equal(drawer.classList.contains("is-open"), false);
  assertUnlocked();
  document.querySelector("#trigger").click();
  dom.flushFrames();
  assert.equal(drawer.classList.contains("is-open"), false);
  bind();
  open();
  close();
  assertUnlocked();
});

test("drawer events fire once per cycle with multiple subscribers", async () => {
  bind();
  bind();
  const counts = { open: 0, opened: 0, close: 0, closed: 0 };
  for (const name of Object.keys(counts)) {
    drawer.addEventListener(`hygular.drawer.${name}`, () => counts[name]++);
  }
  for (let cycle = 1; cycle <= 2; cycle++) {
    open();
    await wait(500);
    close();
    assertUnlocked();
    assert.deepEqual(counts, {
      open: cycle, opened: cycle, close: cycle, closed: cycle,
    });
  }
});

test("canceled drawer events preserve visibility and lock ownership", () => {
  bind();
  bind();
  drawer.addEventListener("hygular.drawer.open", (event) => event.preventDefault(), { once: true });
  document.querySelector("#trigger").click();
  dom.flushFrames();
  assert.equal(drawer.classList.contains("is-open"), false);
  assertUnlocked();
  open();
  drawer.addEventListener("hygular.drawer.close", (event) => event.preventDefault(), { once: true });
  close();
  assert.equal(drawer.classList.contains("is-open"), true);
  assert.equal(document.body.style.overflowY, "hidden");
  close();
  assertUnlocked();
});

test("drawer cleanup preserves another overlay lock and original inline styles", () => {
  document.body.style.setProperty("overflow-y", "auto", "important");
  const overlay = new ScrollLock();
  disposers.push(() => overlay.unlock());
  overlay.lock();
  bind();
  bind();
  open();
  close();
  assert.equal(document.body.style.overflowY, "hidden");
  overlay.unlock();
  assert.equal(document.body.style.overflowY, "auto");
  assert.equal(document.body.style.getPropertyPriority("overflow-y"), "important");
  assert.equal(document.documentElement.style.overflowY, "");
});

test("backdropless drawers do not acquire a scroll lock", () => {
  drawer.classList.add("has-no-backdrop");
  bind();
  bind();
  open();
  assertUnlocked();
  close();
  assertUnlocked();
});

test("drawer registrations and cleanup remain scoped to their document", () => {
  const firstDispose = bind();
  open();
  const firstDocument = document;
  const secondDOM = createDOM(markup);
  const secondDispose = Components.drawer();
  try {
    document.querySelector("#trigger").click();
    secondDOM.flushFrames();
    assert.equal(document.body.style.overflowY, "hidden");
    firstDispose();
    assert.equal(firstDocument.body.style.overflowY, "");
    assert.equal(firstDocument.documentElement.style.overflowY, "");
    assert.equal(document.body.style.overflowY, "hidden");
    document.querySelector(".drawer-close").click();
    endTransition(document.querySelector(".drawer-panel"), "transform");
    assertUnlocked();
    assert.deepEqual(secondDOM.errors, []);
  } finally {
    secondDispose();
    secondDOM.close();
  }
});

test("drawer close releases its lock after a backdrop class change", () => {
  bind();
  open();
  drawer.classList.add("has-no-backdrop");
  close();
  assertUnlocked();
});

test("removing an open drawer releases its lock without disposing the delegate", async () => {
  bind();
  open();
  drawer.remove();
  await wait(0);
  assertUnlocked();
  document.body.append(drawer);
  open();
  close();
  assertUnlocked();
});

test("moving an open drawer within the document preserves its lock", async () => {
  bind();
  open();
  const container = document.createElement("section");
  document.body.append(container);
  container.append(drawer);
  await wait(0);
  assert.equal(drawer.classList.contains("is-open"), true);
  assert.equal(document.body.style.overflowY, "hidden");
  close();
  assertUnlocked();
});

function createSecondDrawer() {
  document.body.insertAdjacentHTML("beforeend", `
    <button id="second-trigger" data-hygular-toggle="drawer" data-target="#second">Open</button>
    <div id="second" class="drawer">
      <div class="drawer-panel"><button class="drawer-close">Close</button></div>
    </div>`);
  return document.querySelector("#second");
}

test("opening another drawer waits for the current drawer to close", async () => {
  bind();
  const second = createSecondDrawer();
  open();
  await wait(500);
  document.querySelector("#second-trigger").click();
  assert.equal(second.classList.contains("is-open"), false);
  endTransition(drawer.querySelector(".drawer-panel"), "transform");
  dom.flushFrames();
  assert.equal(drawer.classList.contains("is-open"), false);
  assert.equal(second.classList.contains("is-open"), true);
  assert.equal(document.body.style.overflowY, "hidden");
  second.querySelector(".drawer-close").click();
  endTransition(second.querySelector(".drawer-panel"), "transform");
  assertUnlocked();
});

test("canceling the current drawer close prevents a pending drawer from opening", () => {
  bind();
  const second = createSecondDrawer();
  open();
  drawer.addEventListener("hygular.drawer.close", event => event.preventDefault(), { once: true });
  document.querySelector("#second-trigger").click();
  dom.flushFrames();
  assert.equal(drawer.classList.contains("is-open"), true);
  assert.equal(second.classList.contains("is-open"), false);
  close();
  dom.flushFrames();
  assert.equal(second.classList.contains("is-open"), false);
  assertUnlocked();
});

test("removing the closing drawer completes a pending switch", async () => {
  bind();
  const second = createSecondDrawer();
  open();
  document.querySelector("#second-trigger").click();
  drawer.remove();
  await wait(0);
  dom.flushFrames();
  assert.equal(second.classList.contains("is-open"), true);
  second.querySelector(".drawer-close").click();
  endTransition(second.querySelector(".drawer-panel"), "transform");
  assertUnlocked();
});

test("removing a pending drawer cancels the switch", () => {
  bind();
  const second = createSecondDrawer();
  open();
  document.querySelector("#second-trigger").click();
  second.remove();
  endTransition(drawer.querySelector(".drawer-panel"), "transform");
  dom.flushFrames();
  assert.equal(second.classList.contains("is-open"), false);
  assertUnlocked();
});

test("disposal cancels a pending drawer switch", async () => {
  const dispose = bind();
  const second = createSecondDrawer();
  open();
  document.querySelector("#second-trigger").click();
  dispose();
  dom.flushFrames();
  await wait(500);
  assert.equal(second.classList.contains("is-open"), false);
  assertUnlocked();
});
