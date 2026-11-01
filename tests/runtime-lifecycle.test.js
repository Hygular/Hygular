import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createDOM, wait, endTransition } from "./helpers/dom.js";

import Components from "../src/js/core/Component.js";
import Form from "../src/js/components/Form.js";
import DomUtils from "../src/js/utils/DomUtils.js";
import DelegateRegistry from "../src/js/utils/DelegateRegistry.js";
import Hygular from "../src/js/core/Hygular.js";
let dom, disposers, savedFetch;
beforeEach(() => {
  dom = createDOM();
  disposers = [];
  savedFetch = globalThis.fetch;
});
afterEach(async () => {
  disposers.reverse().forEach((fn) => fn());
  await wait(0);
  globalThis.fetch = savedFetch;
  const errors = [...dom.errors];
  dom.close();
  assert.deepEqual(errors, []);
});
const trackCleanup = (cleanup) => {
  disposers.push(cleanup);
  return cleanup;
};

const formMarkup =
  '<form data-hygular="form" data-ajax="true" action="/mock" method="post"><input name="title" value="test"><button type="submit">Submit</button></form>';
const drawers = () => {
  document.body.innerHTML = ["a", "b"]
    .map(
      (id) => `
    <button id="open-${id}" data-hygular-toggle="drawer" data-target="#${id}">Open</button>
    <div id="${id}" class="drawer"><div class="drawer-panel"><button class="drawer-close">Close</button></div></div>`,
    )
    .join("");
  trackCleanup(Components.drawer());
};

test("late collapse subscriber initializes newly mounted data-initial-open markup", () => {
  trackCleanup(Components.collapse());
  document.body.innerHTML =
    '<button data-hygular-toggle="collapse" data-target="#panel">Toggle</button><div id="panel" data-initial-open="true">Content</div>';
  trackCleanup(Components.collapse());
  assert.equal(
    document.querySelector("#panel").classList.contains("is-open"),
    true,
  );
  assert.equal(
    document.querySelector("button").getAttribute("aria-expanded"),
    "true",
  );
});

test("late alert subscriber restores persistence on newly mounted markup", () => {
  trackCleanup(Components.alert());
  localStorage.setItem("dismissed-notice", "true");
  document.body.innerHTML =
    '<div data-hygular="alert" data-persistent="true" data-dismiss-key="notice">Dismissed notice</div>';
  trackCleanup(Components.alert());
  assert.equal(document.querySelector('[data-hygular="alert"]'), null);
});

test("old request finally must not enable the button of a new pending request", async () => {
  document.body.innerHTML = formMarkup;
  const signals = [];
  globalThis.fetch = (_url, { signal }) => {
    signals.push(signal);
    return new Promise((_resolve, reject) =>
      signal.addEventListener(
        "abort",
        () => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        },
        { once: true },
      ),
    );
  };
  const first = trackCleanup(Form.init());
  const button = document.querySelector("button");
  button.click();
  first();
  trackCleanup(Form.init());
  button.click();
  assert.equal(signals.length, 2);
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  assert.equal(button.disabled, true);
  await wait(0);
  assert.equal(
    button.disabled,
    true,
    "request #2 is pending but request #1 finally enabled its button",
  );
  assert.equal(button.classList.contains("is-loading"), true);
});

test("a canceled native submit must not start AJAX", async () => {
  document.body.innerHTML = formMarkup;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return { ok: true, json: async () => ({}) };
  };
  trackCleanup(Form.init());
  const form = document.querySelector("form");
  form.addEventListener("submit", (event) => event.preventDefault());
  form.querySelector("button").click();
  await wait(0);
  assert.equal(requests, 0);
});

test("drawer switch waits for panel transform, not backdrop background-color", async () => {
  drawers();
  document.querySelector("#open-a").click();
  dom.flushFrames();
  await wait(480);
  document.querySelector("#open-b").click();
  endTransition(document.querySelector("#a"), "background-color");
  dom.flushFrames();
  assert.equal(
    document.querySelector("#b").classList.contains("is-open"),
    false,
    "backdrop transition finished before the 420ms panel transition",
  );
  endTransition(document.querySelector("#a .drawer-panel"), "transform");
  dom.flushFrames();
  assert.equal(
    document.querySelector("#b").classList.contains("is-open"),
    true,
  );
});

test("drawer open event reentry must not leave two modal owners", () => {
  drawers();
  document.querySelector("#a").addEventListener(
    "hygular.drawer.open",
    () => {
      document.querySelector("#open-b").click();
    },
    { once: true },
  );
  document.querySelector("#open-a").click();
  dom.flushFrames();
  assert.equal(document.querySelectorAll('[aria-modal="true"]').length, 1);
});

test("final alert cleanup must cancel pending dismissal before rebind", async () => {
  document.body.innerHTML =
    '<div data-hygular="alert"><button class="alert-close">Close</button></div>';
  let closed = 0;
  document.addEventListener("hygular.alert.closed", () => closed++);
  const first = trackCleanup(Components.alert());
  const alert = document.querySelector('[data-hygular="alert"]');
  const button = alert.querySelector("button");
  button.click();
  first();
  trackCleanup(Components.alert());
  button.click();
  endTransition(alert);
  await wait(370);
  assert.equal(closed, 1);
});

test("canceling incoming drawer open leaves the existing drawer open", async () => {
  drawers();
  document.querySelector("#open-a").click();
  dom.flushFrames();
  await wait(480);
  document
    .querySelector("#b")
    .addEventListener("hygular.drawer.open", (event) => event.preventDefault());
  document.querySelector("#open-b").click();
  endTransition(document.querySelector("#a .drawer-panel"), "transform");
  dom.flushFrames();
  assert.equal(
    document.querySelector("#a").classList.contains("is-open"),
    true,
  );
});

test("a new collapse subscriber does not reopen an initialized panel", async () => {
  document.body.innerHTML =
    '<button data-hygular-toggle="collapse" data-target="#panel">Toggle</button><div id="panel" data-initial-open="true">Content</div>';
  trackCleanup(Components.collapse());
  document.querySelector("button").click();
  await wait(0);
  trackCleanup(Components.collapse());
  assert.equal(
    document.querySelector("#panel").classList.contains("is-open"),
    false,
  );
  assert.equal(document.querySelector("#panel").style.display, "none");
});

test("accordion subscribers share a listener and preserve an existing closed first item", async () => {
  document.body.innerHTML =
    '<div data-hygular="accordion" data-open-first="true"><div><button class="accordion-toggler">Toggle</button><div class="accordion-content">Content</div></div></div>';
  let clicks = 0;
  const add = document.addEventListener;
  document.addEventListener = function (type, ...args) {
    if (type === "click") clicks++;
    return add.call(this, type, ...args);
  };
  try {
    trackCleanup(Components.accordion());
    document.querySelector("button").click();
    await wait(0);
    trackCleanup(Components.accordion());
    assert.equal(clicks, 1);
    assert.equal(
      document.querySelector("button").classList.contains("is-open"),
      false,
    );
  } finally {
    document.addEventListener = add;
  }
});

test("a canceled form start sends no request and restores its button", async () => {
  document.body.innerHTML = formMarkup;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return { ok: true, json: async () => ({}) };
  };
  trackCleanup(Form.init());
  const form = document.querySelector("form");
  form.addEventListener("hygular.form.start", (event) =>
    event.preventDefault(),
  );
  form.querySelector("button").click();
  await wait(0);
  assert.equal(requests, 0);
  assert.equal(form.querySelector("button").disabled, false);
});

test("removing a form aborts only its request while another subscriber stays active", async () => {
  document.body.innerHTML = formMarkup + formMarkup;
  const calls = [];
  globalThis.fetch = (_url, { signal }) =>
    new Promise((resolve) => calls.push({ signal, resolve }));
  const first = trackCleanup(Form.init());
  trackCleanup(Form.init());
  const [removed, retained] = document.querySelectorAll("form");
  let removedSuccess = 0,
    retainedSuccess = 0;
  removed.addEventListener("hygular.form.success", () => removedSuccess++);
  retained.addEventListener("hygular.form.success", () => retainedSuccess++);
  removed.querySelector("button").click();
  retained.querySelector("button").click();
  first();
  removed.remove();
  await wait(0);
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(calls[1].signal.aborted, false);
  calls.forEach((call) => call.resolve({ ok: true, json: async () => ({}) }));
  await wait(0);
  assert.equal(removedSuccess, 0);
  assert.equal(retainedSuccess, 1);
});

test("moving a form in the same document preserves its pending request", async () => {
  document.body.innerHTML = formMarkup + "<section></section>";
  let signal, resolve;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return new Promise((done) => {
      resolve = done;
    });
  };
  trackCleanup(Form.init());
  const form = document.querySelector("form");
  form.querySelector("button").click();
  document.querySelector("section").append(form);
  await wait(0);
  assert.equal(signal.aborted, false);
  resolve({ ok: true, json: async () => ({}) });
  await wait(0);
});

test("final dropdown cleanup cancels a hover timer before rebinding", async () => {
  document.body.innerHTML =
    '<div class="dropdown" data-trigger="hover"><button data-hygular-toggle="dropdown">Toggle</button></div>';
  dom.window.matchMedia = () => ({ matches: true });
  const first = trackCleanup(Components.dropdown());
  const drop = document.querySelector(".dropdown");
  drop.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  drop.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  first();
  trackCleanup(Components.dropdown());
  await wait(180);
  assert.equal(drop.classList.contains("is-active"), true);
});

test("pending collapse completion cannot emit opened after final cleanup", async () => {
  document.body.innerHTML =
    '<button data-hygular-toggle="collapse" data-target="#panel">Toggle</button><div id="panel">Content</div>';
  let animation;
  dom.window.Element.prototype.animate = () =>
    (animation = {
      cancel() {
        this.oncancel?.();
      },
    });
  const first = trackCleanup(Components.collapse());
  let opened = 0;
  document
    .querySelector("#panel")
    .addEventListener("hygular.collapse.opened", () => opened++);
  document.querySelector("button").click();
  first();
  trackCleanup(Components.collapse());
  animation.onfinish?.();
  await wait(0);
  assert.equal(opened, 0);
});

test("cancelSlide restores inline geometry and leaves unrelated animations alone", async () => {
  document.body.innerHTML =
    '<div style="height:17px!important;overflow:clip;margin-top:3px">Content</div>';
  const element = document.querySelector("div");
  element.getBoundingClientRect = () => ({ height: 17 });
  let canceled = 0;
  element.animate = () => ({
    cancel() {
      canceled++;
      this.oncancel?.();
    },
  });
  const slide = DomUtils.slideUp(element);
  DomUtils.cancelSlide(element);
  await slide;
  assert.equal(canceled, 1);
  assert.equal(element.style.height, "17px");
  assert.equal(element.style.getPropertyPriority("height"), "important");
  assert.equal(element.style.overflow, "clip");
  assert.equal(element.style.marginTop, "3px");
  DomUtils.cancelSlide(element);
  assert.equal(canceled, 1);
});

test("registry rolls back a failed refresh and can bind again", () => {
  let binds = 0,
    cleans = 0;
  assert.throws(
    () =>
      DelegateRegistry.subscribe("probe", () => {
        binds++;
        return {
          refresh() {
            throw new Error("refresh");
          },
          dispose() {
            cleans++;
          },
        };
      }),
    /refresh/,
  );
  const dispose = trackCleanup(
    DelegateRegistry.subscribe("probe", () => {
      binds++;
      return () => cleans++;
    }),
  );
  dispose();
  dispose();
  assert.equal(binds, 2);
  assert.equal(cleans, 2);
});

test("registry refresh reentry shares the binding and runs final cleanup once", () => {
  let binds = 0,
    cleans = 0;
  const bind = () => {
    binds++;
    return {
      refresh() {
        trackCleanup(DelegateRegistry.subscribe("probe", bind));
      },
      dispose() {
        cleans++;
      },
    };
  };
  const first = trackCleanup(DelegateRegistry.subscribe("probe", bind));
  assert.equal(binds, 1);
  first();
  assert.equal(cleans, 0);
  disposers[0]();
  assert.equal(cleans, 1);
});

test("standalone runtime init preserves an open drawer and a pending form", async () => {
  document.body.innerHTML =
    formMarkup +
    '<button id="open" data-hygular-toggle="drawer" data-target="#drawer">Open</button><div id="drawer" class="drawer"><div class="drawer-panel">Content</div></div>';
  let signal, resolve;
  globalThis.fetch = (_url, options) => {
    signal = options.signal;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const runtime = new Hygular();
  trackCleanup(() => runtime.dispose());
  document.querySelector("form button").click();
  document.querySelector("#open").click();
  dom.flushFrames();
  runtime.init();
  assert.equal(signal.aborted, false);
  assert.equal(
    document.querySelector("#drawer").classList.contains("is-open"),
    true,
  );
  assert.equal(document.body.style.overflowY, "hidden");
  resolve({ ok: true, json: async () => ({}) });
  await wait(0);
});

test("canceling a zero-height slide dismissal restores the alert display", async () => {
  document.body.innerHTML =
    '<div data-hygular="alert" data-close-animation="slide"><button class="alert-close">Close</button></div>';
  const dispose = trackCleanup(Components.alert());
  const alert = document.querySelector('[data-hygular="alert"]');
  alert.querySelector("button").click();
  dispose();
  await wait(0);
  assert.equal(alert.isConnected, true);
  assert.equal(alert.style.display, "");
});

test("a timeout while reading the response body cannot emit success", async () => {
  document.body.innerHTML = formMarkup;
  const form = document.querySelector("form");
  form.setAttribute("data-ajax-timeout", "10");
  let finishBody,
    success = 0,
    timeout = 0;
  const previousError = console.error;
  console.error = () => {};
  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: () =>
        new Promise((resolve) => {
          finishBody = resolve;
        }),
    });
    trackCleanup(Form.init());
    form.addEventListener("hygular.form.success", () => success++);
    form.addEventListener("hygular.form.error", (event) => {
      if (event.detail.timeout) timeout++;
    });
    form.querySelector("button").click();
    await wait(25);
    finishBody({});
    await wait(0);
    assert.equal(success, 0);
    assert.equal(timeout, 1);
    assert.equal(form.querySelector("button").disabled, false);
  } finally {
    console.error = previousError;
  }
});

test("inserted markup initializes while the existing subscribers remain mounted", async () => {
  trackCleanup(Components.collapse());
  trackCleanup(Components.alert());
  trackCleanup(Form.init());
  localStorage.setItem("dismissed-notice", "true");
  document.body.innerHTML =
    '<button data-hygular-toggle="collapse" data-target="#late">Toggle</button><div id="late" data-initial-open="true">Content</div><div data-hygular="alert" data-persistent="true" data-dismiss-key="notice">Hidden notice</div><div class="group floating-label"><select><option value="">Choose</option></select></div>';
  await wait(0);
  assert.equal(
    document.querySelector("#late").classList.contains("is-open"),
    true,
  );
  assert.equal(document.querySelector('[data-hygular="alert"]'), null);
  assert.equal(document.querySelectorAll(".select-label").length, 1);
  document.querySelector("button").click();
  await wait(0);
  document.body.append(document.createElement("section"));
  await wait(0);
  assert.equal(
    document.querySelector("#late").classList.contains("is-open"),
    false,
  );
});
