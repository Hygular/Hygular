import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createDOM, endTransition } from "./helpers/dom.js";
import SourceHygular from "../src/js/core/Hygular.js";
import { useDrawer as useSourceDrawer } from "../src/react/index.js";
import { Hygular as BuiltHygular } from "../dist/js/hygular.esm.js";
import { useDrawer as useBuiltDrawer } from "../dist/react/hygular-react.esm.js";

let dom, root, runtimes;
beforeEach(() => {
  dom = createDOM(`
    <div id="app"></div>
    <button id="trigger" data-hygular-toggle="drawer" data-target="#drawer">Open</button>
    <div id="drawer" class="drawer">
      <div class="drawer-panel"><button class="drawer-close">Close</button></div>
    </div>`);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.querySelector("#app"));
  runtimes = [];
});

afterEach(async () => {
  await act(() => root.unmount());
  runtimes.forEach((runtime) => runtime.dispose());
  const errors = [...dom.errors];
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  dom.close();
  assert.deepEqual(errors, []);
});

function open() {
  document.querySelector("#trigger").click();
  dom.flushFrames();
  assert.equal(document.querySelector("#drawer").classList.contains("is-open"), true);
  assert.equal(document.body.style.overflowY, "hidden");
}

function close() {
  document.querySelector(".drawer-close").click();
  endTransition(document.querySelector(".drawer-panel"), "transform");
  assert.equal(document.querySelector("#drawer").classList.contains("is-open"), false);
  assert.equal(document.body.style.overflowY, "");
  assert.equal(document.documentElement.style.overflowY, "");
}

for (const [name, Hygular, useDrawer] of [
  ["source", SourceHygular, useSourceDrawer],
  ["package", BuiltHygular, useBuiltDrawer],
]) {
  function Subscriber() {
    useDrawer();
    return null;
  }

  function subscribers(count) {
    return React.createElement(React.Fragment, null,
      ...Array.from({ length: count }, (_, key) => React.createElement(Subscriber, { key })));
  }

  test(`${name}: useDrawer survives StrictMode setup and cleanup`, async () => {
    await act(() => root.render(React.createElement(StrictMode, null, subscribers(1))));
    open();
    close();
  });

  test(`${name}: two mounted drawer hooks release scroll on close`, async () => {
    await act(() => root.render(subscribers(2)));
    open();
    close();
  });

  test(`${name}: unmounting one hook preserves the remaining drawer subscription`, async () => {
    await act(() => root.render(subscribers(2)));
    open();
    await act(() => root.render(subscribers(1)));
    assert.equal(document.querySelector("#drawer").classList.contains("is-open"), true);
    assert.equal(document.body.style.overflowY, "hidden");
    close();
  });

  test(`${name}: runtime and hook share drawer registration`, async () => {
    const runtime = new Hygular();
    runtimes.push(runtime);
    await act(() => root.render(subscribers(1)));
    open();
    close();
  });

  test(`${name}: runtime reinitialization preserves an active hook subscription`, async () => {
    const runtime = new Hygular();
    runtimes.push(runtime);
    await act(() => root.render(subscribers(1)));
    open();
    runtime.init();
    assert.equal(document.querySelector("#drawer").classList.contains("is-open"), true);
    assert.equal(document.body.style.overflowY, "hidden");
    close();
  });

  for (const owner of ["runtime", "hook"]) {
    test(`${name}: disposing the ${owner} preserves the other subscription`, async () => {
      const runtime = new Hygular();
      runtimes.push(runtime);
      await act(() => root.render(subscribers(1)));
      open();
      if (owner === "runtime") runtime.dispose();
      else await act(() => root.render(null));
      assert.equal(document.querySelector("#drawer").classList.contains("is-open"), true);
      assert.equal(document.body.style.overflowY, "hidden");
      close();
    });
  }

  test(`${name}: final hook unmount releases an open drawer`, async () => {
    await act(() => root.render(subscribers(2)));
    open();
    await act(() => root.render(null));
    assert.equal(document.querySelector("#drawer").classList.contains("is-open"), false);
    assert.equal(document.body.style.overflowY, "");
    assert.equal(document.documentElement.style.overflowY, "");
  });
  test(`${name}: removing drawer markup releases scroll while the hook stays mounted`, async () => {
    document.querySelector("#drawer").remove();
    function ConditionalDrawer({ visible }) {
      useDrawer();
      return visible ? React.createElement("div", { id: "drawer", className: "drawer" },
        React.createElement("div", { className: "drawer-panel" },
          React.createElement("button", { className: "drawer-close" }, "Close"))) : null;
    }
    await act(() => root.render(React.createElement(ConditionalDrawer, { visible: true })));
    open();
    await act(() => root.render(React.createElement(ConditionalDrawer, { visible: false })));
    assert.equal(document.body.style.overflowY, "");
    assert.equal(document.documentElement.style.overflowY, "");
    await act(() => root.render(React.createElement(ConditionalDrawer, { visible: true })));
    open();
    close();
  });

}
