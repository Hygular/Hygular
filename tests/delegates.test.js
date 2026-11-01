import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Hygular from "../src/js/core/Hygular.js";
import Form from "../src/js/components/Form.js";
import * as sourceHooks from "../src/react/index.js";
import { Hygular as BuiltHygular } from "../dist/js/hygular.esm.js";
import * as builtHooks from "../dist/react/hygular-react.esm.js";
import { createDOM, wait, endTransition } from "./helpers/dom.js";

const fixtures = {
  accordion:
    '<div id="target" data-hygular="accordion"><div><button id="trigger" class="accordion-toggler">Open</button><div class="accordion-content">Content</div></div></div>',

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
const hookNames = {
  accordion: "useAccordion",
  dropdown: "useDropdown",
  navbar: "useNavbar",
  collapse: "useCollapse",
  form: "useForm",
  alert: "useAlertDismiss",
};
let dom, root, cleanup, requests, closedEvents, originalFetch;

beforeEach(() => {
  dom = createDOM('<div id="app"></div>');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.querySelector("#app"));
  cleanup = [];
  requests = 0;
  closedEvents = 0;
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requests++;
    return { ok: true, json: async () => ({}) };
  };
  // JSDOM has no Web Animations API; browser tests cover the transitions.
  dom.window.Element.prototype.animate = function () {
    const animation = {
      cancel() {
        this.oncancel?.();
      },
    };
    queueMicrotask(() => animation.onfinish?.());
    return animation;
  };
  document.addEventListener("hygular.alert.closed", () => closedEvents++);
});

afterEach(async () => {
  await act(() => root.unmount());
  cleanup.reverse().forEach((dispose) => dispose());
  globalThis.fetch = originalFetch;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  const errors = [...dom.errors];
  dom.close();
  assert.deepEqual(errors, []);
});

for (const [entry, Runtime, hooks] of [
  ["source", Hygular, sourceHooks],
  ["package", BuiltHygular, builtHooks],
]) {
  for (const component of Object.keys(fixtures)) {
    for (const mode of ["single", "two hooks", "runtime and hook"]) {
      test(`${entry}: ${component} handles one click with ${mode}`, async () => {
        document.body.insertAdjacentHTML("beforeend", fixtures[component]);
        if (mode === "runtime and hook") {
          const runtime = new Runtime();
          cleanup.push(() => runtime.dispose());
        }
        function Subscriber() {
          hooks[hookNames[component]]();
          return null;
        }
        const children = (count) =>
          React.createElement(
            StrictMode,
            null,
            ...Array.from({ length: count }, (_, key) =>
              React.createElement(Subscriber, { key }),
            ),
          );
        await act(() => root.render(children(mode === "two hooks" ? 2 : 1)));
        document.querySelector("#trigger").click();
        await wait(0);
        const target = document.querySelector("#target");
        if (component === "form") assert.equal(requests, 1);
        else if (component === "alert") {
          endTransition(target);
          assert.equal(closedEvents, 1);
          assert.equal(target.isConnected, false);
        } else {
          const element = ["navbar", "accordion"].includes(component)
            ? document.querySelector("#trigger")
            : target;
          const className = ["collapse", "accordion"].includes(component)
            ? "is-open"
            : "is-active";
          assert.equal(element.classList.contains(className), true);
          if (mode === "two hooks") await act(() => root.render(children(1)));
          document.querySelector("#trigger").click();
          await wait(0);
          assert.equal(element.classList.contains(className), false);
        }
      });
    }
  }
}

test("disposing one form subscriber leaves the pending request active", async () => {
  document.body.insertAdjacentHTML("beforeend", fixtures.form);
  let signal, resolve;
  globalThis.fetch = async (_url, options) => {
    requests++;
    signal = options.signal;
    return new Promise((done) => {
      resolve = done;
    });
  };
  const first = Form.init(),
    second = Form.init();
  cleanup.push(first, second);
  document.querySelector("#trigger").click();
  assert.equal(requests, 1);
  first();
  first();
  assert.equal(signal.aborted, false);
  assert.equal(document.querySelector("#trigger").disabled, true);
  resolve({ ok: true, json: async () => ({}) });
  await wait(0);
  assert.equal(document.querySelector("#trigger").disabled, false);
});

test("final form subscriber cleanup aborts a pending request", async () => {
  document.body.insertAdjacentHTML("beforeend", fixtures.form);
  let signal;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener(
        "abort",
        () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        },
        { once: true },
      ),
    );
  };
  const first = Form.init(),
    second = Form.init();
  cleanup.push(first, second);
  document.querySelector("#trigger").click();
  first();
  second();
  await wait(0);
  assert.equal(signal.aborted, true);
  assert.equal(document.querySelector("#trigger").disabled, false);
});

test("new form subscribers initialize newly inserted floating labels", () => {
  const first = Form.init();
  cleanup.push(first);
  document.body.insertAdjacentHTML(
    "beforeend",
    '<div class="group floating-label"><select><option value="">Choose</option><option value="one">One</option></select></div>',
  );
  cleanup.push(Form.init());
  const select = document.querySelector("select");
  assert.equal(document.querySelectorAll(".select-label").length, 1);
  first();
  select.value = "one";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  assert.equal(
    document
      .querySelector(".select-label")
      .classList.contains("floating-label-visible"),
    true,
  );
});
