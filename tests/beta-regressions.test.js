import assert from "node:assert/strict";
import { after, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>", {
  url: "https://hygular.test",
  pretendToBeVisual: true,
});
const { window } = dom;
for (const key of ["window", "document", "Element", "HTMLElement", "Node", "Event",
  "CustomEvent", "MutationObserver", "localStorage"]) globalThis[key] = window[key];
for (const key of ["getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"])
  globalThis[key] = window[key].bind(window);
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const observed = new Set();
globalThis.IntersectionObserver = class {
  observe(element) { observed.add(element); }
  unobserve(element) { observed.delete(element); }
  disconnect() { observed.clear(); }
};
// jsdom has no Web Animations implementation; these tests concern final state.
window.Element.prototype.animate = function () {
  const animation = { cancel() { this.oncancel?.(); } };
  queueMicrotask(() => animation.onfinish?.());
  return animation;
};
const { Form, Hygular, Popover, Modal, Carousel } = await import("../dist/js/hygular.esm.js");
const Components = (await import("../src/js/core/Component.js")).default;
after(() => dom.window.close());

test("optional data-rule fields remain optional", { timeout: 10000 }, () => {
  document.body.innerHTML = '<form data-hygular="form"><input data-rule="email"></form>';
  const dispose = Form.init();
  try {
    const input = document.querySelector("input");
    input.dispatchEvent(new Event("blur"));
    assert.equal(input.validity.valid, true);
    input.required = true;
    input.dispatchEvent(new Event("blur"));
    assert.equal(input.validity.valid, false);
  } finally { dispose(); }
});

test("changing a match dependency clears stale validity before resubmission", { timeout: 10000 }, () => {
  document.body.innerHTML = '<form data-hygular="form"><input id="password" value="abc"><input id="confirmation" data-rule="match:#password" value="xyz"><button>Submit</button></form>';
  const dispose = Form.init();
  try {
    const form = document.querySelector("form");
    const confirmation = document.querySelector("#confirmation");
    let submissions = 0;
    form.addEventListener("submit", (event) => { submissions++; event.preventDefault(); });
    form.requestSubmit();
    assert.equal(confirmation.validity.valid, false);
    const password = document.querySelector("#password");
    password.value = "xyz";
    password.dispatchEvent(new Event("input", { bubbles: true }));
    assert.equal(confirmation.validity.valid, true);
    form.requestSubmit();
    assert.equal(submissions, 2);
  } finally { dispose(); }
});

test("popover toggle aliases are observed initially and after insertion", { timeout: 10000 }, async () => {
  document.body.innerHTML = '<button data-hygular-toggle="popover" data-content="Details"></button>';
  const app = new Hygular();
  try {
    const first = document.querySelector("button");
    assert.ok(observed.has(first));
    app.handleVisibleComponent(first);
    assert.ok(Popover.getInstance(first));
    const second = first.cloneNode(true);
    document.body.append(second);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(observed.has(second));
    app.handleVisibleComponent(second);
    assert.ok(Popover.getInstance(second));
  } finally { app.dispose(); }
});

test("manual lazy initialization does not duplicate an owned instance", { timeout: 10000 }, () => {
  document.body.innerHTML = '<div id="host"></div>';
  const app = new Hygular();
  let created = 0, disposed = 0;
  app.registry.lazy.probe = () => { created++; return { dispose() { disposed++; } }; };
  const host = document.querySelector("#host");
  try {
    assert.equal(app.initializeComponent("probe", host), app.initializeComponent("probe", host));
  } finally { app.dispose(); }
  assert.equal(created, 1);
  assert.equal(disposed, 1);
});

test("accordion synchronizes ARIA and respects disabled triggers", { timeout: 10000 }, async () => {
  document.body.innerHTML = '<div data-hygular="accordion"><div><button class="accordion-toggler">Details</button><div class="accordion-content">Content</div></div></div>';
  const dispose = Components.accordion();
  try {
    const button = document.querySelector("button");
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(button.getAttribute("aria-controls"), document.querySelector(".accordion-content").id);
    button.setAttribute("aria-disabled", "true");
    button.click();
    assert.equal(button.getAttribute("aria-expanded"), "false");
    button.removeAttribute("aria-disabled");
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(button.getAttribute("aria-expanded"), "true");
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(button.getAttribute("aria-expanded"), "false");
  } finally { dispose(); }
});

test("carousel pager exposes named native buttons", { timeout: 10000 }, () => {
  document.body.innerHTML = '<div class="carousel"><div class="carousel-items"><div class="item">One</div><div class="item">Two</div></div></div>';
  const carousel = Carousel.create(".carousel", { autoplay: { enabled: false } });
  try {
    const buttons = document.querySelectorAll(".pager button");
    assert.equal(buttons.length, 2);
    assert.equal(buttons[1].getAttribute("aria-label"), "Go to slide 2");
    buttons[1].click();
    assert.equal(buttons[1].getAttribute("aria-current"), "true");
  } finally { carousel.dispose(); }
});

test("core and React modals share the same scroll lock", { timeout: 10000 }, async () => {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { useModal } = await import("../dist/react/hygular-react.esm.js");
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = '<div id="app"></div>';
  document.body.style.removeProperty("overflow-y");
  let api;
  function Probe() { api = useModal(); return null; }
  const root = createRoot(document.querySelector("#app"));
  await React.act(async () => root.render(React.createElement(Probe)));
  try {
    const first = Modal.alert({ content: "Core" });
    const second = api.alert({ content: "React" });
    assert.equal(document.body.style.overflowY, "hidden");
    document.querySelector(".modal-close").click();
    await first;
    assert.equal(document.querySelectorAll(".modal").length, 1);
    assert.equal(document.body.style.overflowY, "hidden");
    document.querySelector(".modal-close").click();
    await second;
    assert.equal(document.body.style.overflowY, "");
  } finally { await React.act(async () => root.unmount()); }
});

test("server feedback uses the CSS marker and clears on corrected submission", { timeout: 10000 }, async () => {
  document.body.innerHTML = '<form data-hygular="form" data-ajax="true"><input name="email" value="first@example.com"><button>Send</button></form>';
  const saved = new Map(["fetch", "FormData", "CSS"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.FormData = window.FormData;
  // This fixture uses one fixed field name; selector escaping itself is not under test.
  globalThis.CSS = { escape(name) { assert.equal(name, "email"); return name; } };
  let requests = 0;
  globalThis.fetch = async () => ({
    ok: ++requests > 1,
    json: async () => requests === 1 ? { errors: { email: ["Already registered"] } } : {},
  });
  const dispose = Form.init();
  const form = document.querySelector("form");
  try {
    const rejected = new Promise((resolve) => form.addEventListener("hygular.form.error", resolve, { once: true }));
    form.requestSubmit();
    await rejected;
    const feedback = form.querySelector(".form-feedback");
    assert.equal(feedback.textContent, "Already registered");
    assert.ok(feedback.classList.contains("is-server"));
    assert.ok(feedback.classList.contains("with-error"));
    const input = form.querySelector("input");
    input.value = "second@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    assert.equal(input.validity.valid, true);
    const accepted = new Promise((resolve) => form.addEventListener("hygular.form.success", resolve, { once: true }));
    form.requestSubmit();
    await accepted;
    assert.equal(requests, 2);
    assert.equal(feedback.textContent, "");
    assert.equal(feedback.classList.contains("is-server"), false);
    assert.equal(feedback.classList.contains("with-error"), false);
  } finally {
    dispose();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("change events revalidate a touched match dependency", { timeout: 10000 }, () => {
  document.body.innerHTML = '<form data-hygular="form"><select id="choice"><option value="a">A</option><option value="b">B</option></select><input id="copy" data-rule="match:#choice" value="b"></form>';
  const dispose = Form.init();
  try {
    const field = document.querySelector("#copy");
    field.dispatchEvent(new Event("blur"));
    assert.equal(field.validity.valid, false);
    const choice = document.querySelector("#choice");
    choice.value = "b";
    choice.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(field.validity.valid, true);
  } finally { dispose(); }
});
