import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const root = new URL("../../", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

test("every package export points to a generated file", async () => {
  async function inspect(value) {
    if (typeof value === "string") await access(new URL(value, root));
    else for (const nested of Object.values(value)) await inspect(nested);
  }
  await inspect(pkg.exports);
});
test("npm pack includes declarations and styles, but excludes development tests", () => {
  const output = JSON.parse(
    execFileSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["pack", "--dry-run", "--json", "--ignore-scripts"],
      { cwd: root, encoding: "utf8", shell: process.platform === "win32" },
    ),
  );
  const paths = new Set(output[0].files.map((file) => file.path));
  for (const file of [
    "index.d.ts",
    "dist/react/index.d.ts",
    "dist/js/hygular.esm.js",
    "dist/css/hygular.css",
    "dist/css/hygular.min.css",
  ])
    assert.ok(paths.has(file), file);
  const inspectPacked = (value) => {
    if (typeof value === "string")
      assert.ok(paths.has(value.replace(/^\.\//, "")), value);
    else Object.values(value).forEach(inspectPacked);
  };
  inspectPacked(pkg.exports);
  for (const entry of [pkg.main, pkg.module, pkg.browser, pkg.style])
    inspectPacked(entry);
  assert.ok(
    [...paths].some(
      (path) => path.startsWith("dist/js/shared/") && path.endsWith(".js"),
    ),
  );
  assert.ok(paths.has("CHANGELOG.md"));
  assert.ok(paths.has("CONTRIBUTING.md"));
  assert.ok(![...paths].some((path) => path.startsWith("tests/")));
});
test("compiled JavaScript imports outside the browser", async () => {
  const core = await import("../../dist/js/hygular.esm.js");
  const react = await import("../../dist/react/hygular-react.esm.js");
  assert.equal(typeof core.Hygular, "function");
  assert.equal(typeof react.useRange, "function");
});
