import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createDOM, wait, key, endTransition } from "./helpers/dom.js";
import {
  Alert,
  Popover,
  Tooltip,
  Select,
  Toast,
  Modal,
  Range,
  Hygular,
  Skeleton,
  Carousel,
  Form,
  DarkMode,
  LazyImage,
} from "../src/js/index.js";
import Components from "../src/js/core/Component.js";
import ScrollLock from "../src/js/utils/ScrollLock.js";
import DomUtils from "../src/js/utils/DomUtils.js";
let dom;
beforeEach(() => {
  dom = createDOM('<input id="target"><button id="trigger">Open</button>');
});
afterEach(() => {
  const errors = [...dom.errors];
  dom.close();
  assert.deepEqual(errors, []);
});
const target = () => document.querySelector("#target");
const trigger = () => document.querySelector("#trigger");
const data = [
  { value: 0, name: "Zero" },
  { value: 1, name: "One" },
  { value: 2, name: "Two" },
];

test("Alert removes every generated alert on disposal", () => {
  const alert = Alert.create(target());
  alert.build();
  assert.equal(document.querySelectorAll(".alert").length, 2);
  alert.dispose();
  alert.dispose();
  alert.build();
  assert.equal(document.querySelectorAll(".alert").length, 0);
});
test("Alert fade completes without a transition event", async () => {
  const alert = Alert.create(target(), { autoClean: true });
  document.querySelector(".alert-close").click();
  await wait(280);
  assert.equal(document.querySelector(".alert"), null);
  alert.dispose();
});
test("Alert disposal cancels a pending dismissal", async () => {
  const alert = Alert.create(target());
  document.querySelector(".alert-close").click();
  alert.dispose();
  await wait(280);
  assert.equal(document.querySelector(".alert"), null);
});
test("Popover respects canceled hide but disposal always cleans up", () => {
  trigger().setAttribute("aria-controls", "original");
  const popover = new Popover(trigger(), { content: "Content" });
  trigger().addEventListener("hygular.popover.hide", (e) => e.preventDefault());
  popover.show();
  popover.hide();
  assert.ok(document.querySelector(".popover"));
  popover.dispose();
  dom.flushFrames();
  assert.equal(document.querySelector(".popover"), null);
  assert.equal(trigger().getAttribute("aria-controls"), "original");
});
test("Popover ignores a previous opening frame after reopen", () => {
  let shown = 0;
  trigger().addEventListener("hygular.popover.shown", () => shown++);
  const p = new Popover(trigger(), { content: "<b>Text</b>" });
  p.show();
  p.hide();
  p.show();
  dom.flushFrames();
  assert.equal(shown, 1);
  assert.equal(
    document.querySelector(".popover-body").textContent,
    "<b>Text</b>",
  );
  p.dispose();
});
test("Tooltip preserves existing description and inline positioning", () => {
  trigger().setAttribute("aria-describedby", "hint");
  trigger().style.position = "static";
  const t = new Tooltip(trigger(), { message: "Help" });
  t.show();
  dom.flushFrames();
  assert.match(trigger().getAttribute("aria-describedby"), /^hint /);
  t.hide();
  assert.equal(trigger().getAttribute("aria-describedby"), "hint");
  assert.equal(trigger().style.position, "static");
  t.dispose();
});
test("Select accepts zero defaults and keyboard selection", () => {
  const select = new Select(target(), { data, defaultValue: 0 });
  const control = document.querySelector(".selected-option");
  assert.equal(target().value, "0");
  key(control, "Enter");
  key(control, "ArrowDown");
  key(control, "Enter");
  assert.equal(target().value, "1");
  assert.equal(control.getAttribute("aria-expanded"), "false");
  select.dispose();
});
test("Select cancels the closing timer when reopened", async () => {
  const select = new Select(target(), { data });
  select.open();
  select.close();
  select.open();
  await wait(230);
  assert.equal(document.querySelector(".options-container").hidden, false);
  select.dispose();
});
test("Select searches and selects the visible keyboard option", () => {
  const select = new Select(target(), { data, search: true });
  key(document.querySelector(".selected-option"), "Enter");
  const input = document.querySelector(".options-container input");
  input.value = "Two";
  input.dispatchEvent(new Event("input"));
  key(input, "Enter");
  assert.equal(target().value, "2");
  select.dispose();
});
test("Select resize measures current tags and cleans its observer", () => {
  const select = new Select(target(), { data, multiple: true });
  const display = document.querySelector(".selected-option");
  display.getBoundingClientRect = () => ({ width: 130 });
  select.select(data[0]);
  select.select(data[1]);
  document
    .querySelectorAll(".select-tag")
    .forEach((tag) => Object.defineProperty(tag, "offsetWidth", { value: 60 }));
  dom.flushFrames();
  assert.equal(document.querySelector(".more-tag").textContent, "+1 more");
  select.remove(0);
  select.remove(1);
  dom.flushFrames();
  assert.equal(document.querySelector(".more-tag"), null);
  select.dispose();
  assert.ok(dom.observers.at(-1).disconnected);
});
test("Toast replacement clears the previous element and registry entry", () => {
  const first = Toast.show({ message: "First" });
  const second = Toast.show({ message: "Second", dismissPrevious: true });
  first.build();
  assert.equal(document.querySelectorAll(".toast").length, 2);
  assert.equal(Toast.instances.size, 2);
  first.dispose();
  second.dispose();
  dom.flushFrames();
  assert.equal(Toast.instances.size, 0);
});
test("Toast build is idempotent and safe after disposal", () => {
  const toast = Toast.show();
  toast.build();
  assert.equal(document.querySelectorAll(".toast").length, 1);
  toast.dispose();
  toast.build();
  dom.flushFrames();
  assert.equal(document.querySelector(".toast"), null);
});
test("Modal confirmation remains pending when closing is canceled", async () => {
  let allow = false,
    resolved = false;
  const result = Modal.confirm({ onClose: () => allow }).then((value) => {
    resolved = true;
    return value;
  });
  document.querySelector(".modal-confirm").click();
  await Promise.resolve();
  assert.equal(resolved, false);
  allow = true;
  document.querySelector(".modal-confirm").click();
  endTransition(document.querySelector(".modal"));
  assert.equal(await result, true);
  dom.flushFrames();
});
test("Modal dispose cancels opening callbacks and releases its lock", async () => {
  let opened = 0;
  const modal = new Modal("confirm", { onOpened: () => opened++ });
  const result = modal.build();
  modal.dispose();
  modal.dispose();
  dom.flushFrames();
  assert.equal(await result, false);
  await wait(360);
  assert.equal(opened, 0);
  assert.equal(document.querySelector(".modal"), null);
  assert.equal(document.documentElement.style.overflowY, "");
});
test("Modal queue waits for the previous exit before opening the next dialog", async () => {
  const first = Modal.queue.confirm({ content: "First" });
  const second = Modal.queue.alert({ content: "Second" });
  document.querySelector(".modal-confirm").click();
  assert.equal(document.querySelectorAll(".modal").length, 1);
  endTransition(document.querySelector(".modal"));
  assert.equal(await first, true);
  await Promise.resolve();
  assert.equal(document.querySelector(".modal-body").textContent, "Second");
  document.querySelector(".modal-close").click();
  endTransition(document.querySelector(".modal"));
  await second;
  dom.flushFrames();
});
test("Custom modal closes without removing user markup", async () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="custom" class="modal"><div class="modal-dialog"><button class="modal-close">Close</button></div></div>',
  );
  const result = Modal.custom({ id: "#custom" });
  dom.flushFrames();
  document.querySelector("#custom .modal-close").click();
  endTransition(document.querySelector("#custom"));
  await result;
  assert.ok(document.querySelector("#custom"));
  assert.equal(
    document.querySelector("#custom").classList.contains("is-open"),
    false,
  );
});
test("ScrollLock shares ownership and restores style priorities", () => {
  document.body.style.setProperty("overflow-y", "auto", "important");
  const first = new ScrollLock(),
    second = new ScrollLock();
  first.lock().lock();
  second.lock();
  first.unlock();
  assert.equal(document.body.style.overflowY, "hidden");
  second.unlock();
  assert.equal(document.body.style.overflowY, "auto");
  assert.equal(
    document.body.style.getPropertyPriority("overflow-y"),
    "important",
  );
});
test("Range clamps programmatic values and removes generated elements", () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="range"><input type="range" min="0" max="100" value="20"></div>',
  );
  const el = document.querySelector("#range"),
    range = new Range(el);
  range.setValue(200);
  assert.equal(range.getValue(), 100);
  dom.flushFrames();
  range.dispose();
  assert.equal(el.querySelector(".form-range-tooltip"), null);
  assert.equal(Range.getInstance(el), null);
});
test("Hygular repeated init does not multiply delegated toggles", () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div class="dropdown"><button data-hygular-toggle="dropdown">Menu</button><div class="dropdown-menu"></div></div>',
  );
  const runtime = new Hygular();
  runtime.init();
  const button = document.querySelector('[data-hygular-toggle="dropdown"]');
  button.click();
  assert.ok(button.parentElement.classList.contains("is-active"));
  runtime.dispose();
  runtime.init();
  button.click();
  assert.ok(button.parentElement.classList.contains("is-active"));
});
test("Drawer disposal prevents stale opening work", async () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<button id="drawer-button" data-hygular-toggle="drawer" data-target="#drawer"></button><div id="drawer" class="drawer"><div class="drawer-panel"></div></div>',
  );
  let opened = 0;
  const drawer = document.querySelector("#drawer");
  drawer.addEventListener("hygular.drawer.opened", () => opened++);
  const dispose = Components.drawer();
  document.querySelector("#drawer-button").click();
  dispose();
  dom.flushFrames();
  await wait(490);
  assert.equal(opened, 0);
  assert.equal(drawer.classList.contains("is-open"), false);
  assert.equal(document.body.style.overflowY, "");
});
test("Skeleton restores accessibility attributes after loading", () => {
  const el = target();
  el.setAttribute("aria-label", "Original");
  Skeleton.show(el);
  Skeleton.show(el);
  assert.equal(el.querySelectorAll("[data-skeleton-injected]").length, 1);
  Skeleton.hide(el);
  assert.equal(el.getAttribute("aria-label"), "Original");
  assert.equal(el.hasAttribute("aria-hidden"), false);
});
test("Carousel navigation clamps and cleans generated controls", () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div id="carousel"><div class="carousel-items"><div class="item"></div><div class="item"></div></div></div>',
  );
  const c = Carousel.create("#carousel", {
    loop: false,
    autoplay: { enabled: false },
  });
  c.go(5);
  assert.equal(
    document.querySelector(".carousel-items").style.transform,
    "translateX(-100%)",
  );
  c.dispose();
  assert.equal(document.querySelector(".carousel-next"), null);
});
test("Form validates custom rules after blur and removes delegation", () => {
  document.body.innerHTML =
    '<form data-hygular="form"><div><input data-rule="minlen:3" value="a"></div></form>';
  const dispose = Form.init(),
    field = document.querySelector("input");
  field.dispatchEvent(new Event("blur"));
  assert.equal(field.validity.valid, false);
  field.value = "abcd";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(field.validity.valid, true);
  dispose();
});
test("DarkMode toggles and detaches its custom button", () => {
  const mode = new DarkMode({ customBtn: "#trigger" });
  trigger().click();
  assert.equal(mode.isDark(), true);
  mode.dispose();
  trigger().click();
  assert.equal(
    document.documentElement.getAttribute("data-hygular-theme"),
    "dark",
  );
});
test("LazyImage builds a placeholder from a deferred source", () => {
  const img = document.createElement("img");
  img.dataset.src = "/photo.png";
  document.body.append(img);
  LazyImage.load(img);
  assert.ok(img.parentElement.classList.contains("hygular-image-wrap"));
});
test("slideUp removes an already collapsed element when requested", async () => {
  const el = target();
  await DomUtils.slideUp(el, 0, true);
  assert.equal(el.isConnected, false);
});

test("Form floating labels rebind after runtime cleanup and initialization", () => {
  document.body.innerHTML =
    '<form data-hygular="form"><div class="group floating-label"><select><option value="">Choose</option><option value="one">One</option></select></div></form>';
  let dispose = Form.init();
  dispose();
  dispose = Form.init();
  const select = document.querySelector("select");
  select.value = "one";
  select.dispatchEvent(new Event("change"));
  assert.ok(
    document
      .querySelector(".select-label")
      .classList.contains("floating-label-visible"),
  );
  dispose();
});
test("Form GET submission serializes fields into the URL without a body", async () => {
  document.body.innerHTML =
    '<form data-hygular="form" data-ajax="true" method="get" action="/search"><input name="q" value="hello world"></form>';
  const previous = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({}) };
  };
  const dispose = Form.init();
  try {
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await wait(0);
    assert.equal(new URL(request.url).searchParams.get("q"), "hello world");
    assert.equal("body" in request.options, false);
  } finally {
    globalThis.fetch = previous;
    dispose();
  }
});
test("Range emits constrained dual values instead of the crossed raw input", () => {
  document.body.innerHTML =
    '<div id="range"><input type="range" min="0" max="100" value="20"><input type="range" min="0" max="100" value="50"></div>';
  const el = document.querySelector("#range"),
    range = new Range(el);
  let detail;
  el.addEventListener("hygular.range.input", (event) => {
    detail = event.detail;
  });
  el.firstElementChild;
  const input = el.querySelector("input");
  input.value = "80";
  input.dispatchEvent(new Event("input"));
  assert.deepEqual(detail.value, [49, 50]);
  assert.deepEqual(range.getValue(), [49, 50]);
  range.dispose();
});
test("Range RTL ticks use physical left coordinates only once", () => {
  document.body.innerHTML =
    '<div id="range" style="direction:rtl"><input type="range" min="0" max="100" list="ticks"></div><datalist id="ticks"><option value="0" label="Start"></option></datalist>';
  const range = new Range(document.querySelector("#range"));
  assert.equal(document.querySelector(".form-range-tick").style.left, "100%");
  range.dispose();
});
test("Tabview changes panels with keyboard navigation and detaches on disposal", () => {
  document.body.innerHTML =
    '<div id="tabs"><button data-tab="#one">One</button><button data-tab="#two">Two</button></div><div id="one"></div><div id="two"></div>';
  const tabs = document.querySelector("#tabs"),
    instance = Components.tabview(tabs);
  key(tabs.firstElementChild, "ArrowRight");
  assert.equal(tabs.lastElementChild.getAttribute("aria-selected"), "true");
  assert.ok(document.querySelector("#two").classList.contains("is-open"));
  instance.dispose();
});
test("Collapse honors a canceled opening event", () => {
  document.body.innerHTML =
    '<button data-hygular-toggle="collapse" data-target="#panel"></button><div id="panel"></div>';
  const dispose = Components.collapse();
  const panel = document.querySelector("#panel");
  panel.addEventListener("hygular.collapse.open", (e) => e.preventDefault());
  document.querySelector("button").click();
  assert.equal(panel.style.display, "none");
  dispose();
});
test("Accordion honors a canceled opening event", async () => {
  document.body.innerHTML =
    '<div data-hygular="accordion"><div><button class="accordion-toggler"></button><div class="accordion-content"></div></div></div>';
  const dispose = Components.accordion();
  document
    .querySelector("[data-hygular]")
    .addEventListener("hygular.accordion.open", (e) => e.preventDefault());
  document.querySelector("button").click();
  await Promise.resolve();
  assert.equal(
    document.querySelector("button").classList.contains("is-open"),
    false,
  );
  dispose();
});
test("Badge caps visible counts while keeping the full accessible label", () => {
  const el = target();
  el.dataset.count = "120";
  Components.badge(el);
  assert.equal(el.textContent, "99+");
  assert.equal(el.getAttribute("aria-label"), "120");
});
test("Navbar removes its click delegation on cleanup", () => {
  document.body.innerHTML =
    '<button data-hygular-toggle="navbar" data-target="#menu"></button><div id="menu" class="navbar-menu"></div>';
  const dispose = Components.navbar();
  dispose();
  document.querySelector("button").click();
  assert.equal(
    document.querySelector("button").classList.contains("is-active"),
    false,
  );
});
test("Swiper stops responding to pointer events after disposal", () => {
  document.body.innerHTML =
    '<div id="swiper"><div class="swiper-wrapper"></div></div>';
  const el = document.querySelector("#swiper"),
    instance = Components.swiper(el);
  instance.dispose();
  el.firstElementChild.dispatchEvent(
    new Event("pointerdown", { bubbles: true }),
  );
  assert.equal(el.classList.contains("is-dragging"), false);
});

test("Hygular disposes removed lazy instances but retains moved elements", async () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    '<button id="lazy" data-hygular="tooltip" data-tooltip="Help"></button><div id="destination"></div>',
  );
  const el = document.querySelector("#lazy"),
    runtime = new Hygular();
  const tooltip = runtime.initializeComponent("tooltip", el);
  document.querySelector("#destination").append(el);
  await wait(0);
  assert.equal(Tooltip.getInstance(el), tooltip);
  el.remove();
  await wait(0);
  assert.equal(Tooltip.getInstance(el), undefined);
  assert.equal(runtime.componentInstances.size, 0);
  runtime.dispose();
});
test("DarkMode honors a saved light choice and detaches from the original media query", () => {
  const queries = [];
  window.matchMedia = () => {
    const listeners = new Set();
    const query = {
      matches: false,
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
      listeners,
    };
    queries.push(query);
    return query;
  };
  localStorage.setItem("darkMode", "disabled");
  document.documentElement.setAttribute("data-hygular-theme", "dark");
  const mode = new DarkMode({ autoCreateBtn: false });
  assert.equal(mode.isDark(), false);
  assert.equal(queries.at(-1).listeners.size, 1);
  mode.dispose();
  assert.equal(queries.at(-1).listeners.size, 0);
});
test("LazyImage does not wrap the same pending image twice", () => {
  const img = document.createElement("img");
  img.dataset.src = "/photo.png";
  document.body.append(img);
  LazyImage.load(img);
  LazyImage.load(img);
  assert.equal(document.querySelectorAll(".hygular-image-wrap").length, 1);
});

test('Navbar removes Escape handling even when cleanup follows opening', async () => {
  document.body.innerHTML = '<button data-hygular-toggle="navbar" data-target="#menu"></button><div id="menu" class="navbar-menu"></div>';
  const pending = [];
  const previous = DomUtils.slideDown;
  DomUtils.slideDown = () => new Promise((resolve) => pending.push(resolve));
  try {
    const dispose = Components.navbar(); document.querySelector('button').click(); dispose(); pending[0](); await wait(0);
    assert.equal(document.querySelector('#menu')._escapeHandler, undefined);
    const disposeAgain = Components.navbar(); document.querySelector('button').classList.remove('is-active'); document.querySelector('button').click(); pending[1](); await wait(0);
    assert.equal(typeof document.querySelector('#menu')._escapeHandler, 'function'); disposeAgain();
    assert.equal(document.querySelector('#menu')._escapeHandler, null);
  } finally { DomUtils.slideDown = previous; }
});
test('Form cleanup aborts pending submission without a late error event', async () => {
  document.body.innerHTML = '<form data-hygular="form" data-ajax="true"><input name="q" value="test"><button type="submit">Save</button></form>';
  const previous = globalThis.fetch; let signal, errorEvents = 0;
  globalThis.fetch = (_, options) => { signal = options.signal; return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))); };
  const dispose = Form.init(), form = document.querySelector('form'), button = form.querySelector('button');
  form.addEventListener('hygular.form.error', () => errorEvents++);
  try {
    const event = new Event('submit', { bubbles: true, cancelable: true }); Object.defineProperty(event, 'submitter', { value: button }); form.dispatchEvent(event);
    assert.equal(button.disabled, true); dispose(); await wait(0);
    assert.equal(signal.aborted, true); assert.equal(button.disabled, false); assert.equal(errorEvents, 0);
  } finally { dispose(); globalThis.fetch = previous; }
});
test('DarkMode continues working when storage throws', () => {
  const storage = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Blocked'); } };
  try { const mode = new DarkMode({ customBtn: '#trigger' }); trigger().click(); assert.equal(mode.isDark(), true); mode.dispose(); }
  finally { globalThis.localStorage = storage; }
});
test('LazyImage observation returns idempotent cleanup', () => {
  const dispose = LazyImage.observe(); const observer = dom.observers.at(-1);
  dispose(); dispose(); assert.equal(observer.disconnected, true);
});
test('Skeleton mounting returns cleanup that cannot be canceled by hide listeners', () => {
  document.body.innerHTML = '<div data-skeleton aria-label="Original"></div>';
  const el = document.querySelector('[data-skeleton]'); el.addEventListener('hygular.skeleton.hide', (event) => event.preventDefault());
  const cleanup = Skeleton.mount(); assert.equal(Skeleton.mount(), cleanup); assert.equal(el.skeletonActive, true);
  cleanup(); cleanup(); assert.equal(el.skeletonActive, false); assert.equal(el.getAttribute('aria-label'), 'Original');
  assert.equal(el.querySelector('[data-skeleton-injected]'), null);
});
