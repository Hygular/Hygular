import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import * as api from "../src/js/index.js";
import ScrollLock from "../src/js/utils/ScrollLock.js";

test("all JavaScript source modules import without browser globals", async () => {
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const url = new URL(
        entry.name + (entry.isDirectory() ? "/" : ""),
        directory,
      );
      if (entry.isDirectory()) await visit(url);
      else if (entry.name.endsWith(".js")) await import(url.href);
    }
  }
  assert.equal(typeof document, "undefined");
  await visit(new URL("../src/", import.meta.url));
});
test("SSR-safe constructors can be disposed without DOM access", () => {
  for (const instance of [
    new api.Hygular(),
    new api.Select(),
    new api.Popover(),
    new api.Tooltip(),
    new api.Alert(),
    new api.Carousel(),
    new api.Range(),
    new api.DarkMode(),
    new api.Toast(),
  ]) {
    assert.doesNotThrow(() => instance.dispose());
  }
  const lock = new ScrollLock();
  lock.lock().unlock();
  assert.equal(lock.getScrollbarWidth(), 0);
});
test("dialog helpers and initialization are inert during SSR", async () => {
  assert.equal(await api.Modal.alert(), undefined);
  assert.equal(await api.Modal.confirm(), false);
  assert.equal(await api.Modal.custom(), undefined);
  api.Range.init();
  api.Skeleton.mount();
  api.LazyImage.observe();
  api.Form.init()();
});
