import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React, { act, StrictMode, useRef } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  useSelect,
  usePopover,
  useRange,
  useTooltip,
} from "../src/react/index.js";
import { createDOM } from "./helpers/dom.js";
let dom, root;
beforeEach(() => {
  dom = createDOM('<div id="app"></div>');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.querySelector("#app"));
});
afterEach(async () => {
  await act(() => root.unmount());
  const errors = [...dom.errors];
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  dom.close();
  assert.deepEqual(errors, []);
});

test("Select, Popover and Tooltip survive StrictMode setup and cleanup", async () => {
  function App() {
    const selectRef = useRef(null);
    useSelect(selectRef, { data: [{ value: 1, name: "One" }] });
    const popoverRef = usePopover({ content: "Details" }),
      tooltipRef = useTooltip({ message: "Help" });
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("input", { ref: selectRef }),
      React.createElement("button", { ref: popoverRef, id: "popover" }, "Open"),
      React.createElement("button", { ref: tooltipRef }, "Help"),
    );
  }
  await act(() =>
    root.render(
      React.createElement(StrictMode, null, React.createElement(App)),
    ),
  );
  assert.equal(document.querySelectorAll(".custom-select").length, 1);
  await act(() => document.querySelector("#popover").click());
  dom.flushFrames();
  assert.ok(document.querySelector(".popover"));
  await act(() => root.render(null));
  assert.equal(document.querySelector(".popover"), null);
  assert.equal(document.querySelector(".custom-select"), null);
});
test("useRange exposes the clamped value and the latest callback", async () => {
  let controls,
    observed = [];
  function App({ revision }) {
    controls = useRange({
      onInput: (value) => observed.push([revision, value]),
    });
    return React.createElement(
      "div",
      { ref: controls.ref },
      React.createElement("input", {
        type: "range",
        min: 0,
        max: 100,
        defaultValue: 20,
      }),
    );
  }
  await act(() => root.render(React.createElement(App, { revision: 1 })));
  await act(() => controls.setValue(200));
  assert.equal(controls.value, 100);
  assert.equal(controls.getValue(), 100);
  await act(() => root.render(React.createElement(App, { revision: 2 })));
  await act(() => controls.setValue(30));
  assert.deepEqual(observed.at(-1), [2, 30]);
  dom.flushFrames();
});
test("hooks render server markup without running DOM initialization", () => {
  function App() {
    const ref = usePopover({ content: "Details" });
    return React.createElement("button", { ref }, "Open");
  }
  assert.equal(
    renderToString(React.createElement(App)),
    "<button>Open</button>",
  );
});
