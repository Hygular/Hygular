import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import { applyBreakpoints, DEFAULT_BREAKPOINTS } from "../build/breakpoints.js";
const text = await readFile(
  new URL("../src/css/hygular.css", import.meta.url),
  "utf8",
);

test("stylesheet parses and breakpoint placeholders resolve in compiled CSS", () => {
  const root = postcss.parse(text);
  applyBreakpoints(root, DEFAULT_BREAKPOINTS);
  root.walkAtRules("media", (rule) =>
    assert.doesNotMatch(rule.params, /var\(--breakpoint-/),
  );
  for (const [name, value] of Object.entries(DEFAULT_BREAKPOINTS)) {
    const sample = postcss.parse(
      `@media (min-width: var(--breakpoint-${name})) {.test {display:block}}`,
    );
    applyBreakpoints(sample, DEFAULT_BREAKPOINTS);
    assert.ok(sample.toString().includes(value));
  }
});
test("every referenced CSS variable is defined, supplied by JS, or has a fallback", () => {
  const root = postcss.parse(text),
    defined = new Set();
  root.walkDecls((d) => {
    if (d.prop.startsWith("--")) defined.add(d.prop);
  });
  const runtime = new Set([
    "--range-progress",
    "--range-min",
    "--range-max",
    "--range-tooltip-x",
  ]);
  root.walkDecls((d) => {
    for (const match of d.value.matchAll(/var\((--[\w-]+)\s*([,)])/g)) {
      assert.ok(
        defined.has(match[1]) || runtime.has(match[1]) || match[2] === ",",
        `${match[1]} has no value or fallback at line ${d.source.start.line}`,
      );
    }
  });
});
test("Select exposes visible keyboard focus and option states", () => {
  const selectors = [];
  postcss.parse(text).walkRules((r) => selectors.push(r.selector));
  for (const selector of [
    ".select-option.is-active",
    ".tag-remove:focus-visible",
    ".selected-option:focus-visible",
  ])
    assert.ok(
      selectors.some((s) => s.includes(selector)),
      selector,
    );
});

test("distributed media queries contain resolved breakpoint values", async () => {
  const built = postcss.parse(
    await readFile(
      new URL("../dist/css/hygular.min.css", import.meta.url),
      "utf8",
    ),
  );
  built.walkAtRules("media", (rule) =>
    assert.ok(!rule.params.includes("var(--breakpoint-"), rule.params),
  );
});

test("carousel button markup has matching styles and keyboard focus", () => {
  const selectors = [];
  postcss.parse(text).walkRules((rule) => selectors.push(rule.selector));
  for (const selector of [
    ".carousel > .pager > .item > button",
    ".carousel > .thumbnails > .item > button",
    ".carousel > :is(.pager, .thumbnails) > .item > button:focus-visible",
    ".carousel .thumbnails > .item > button > .thumbnail-image",
  ])
    assert.ok(
      selectors.some((value) => value.includes(selector)),
      selector,
    );
});
