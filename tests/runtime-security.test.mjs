import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { callTool } from "../plugins/cgo/server/tools.mjs";
import { makeFixture } from "./helpers.mjs";

function parseToolText(result) {
  return JSON.parse(result.content[0].text);
}

test("default plugin data is private, user-owned, and outside shared temporary storage", () => {
  const fixture = makeFixture();
  try {
    const result = callTool("doctor", {}, {
      ...process.env,
      CLAUDE_CONFIG_DIR: fixture.configDir,
      CGO_PROJECT_DIR: fixture.projectDir,
      CGO_PLUGIN_DATA: undefined,
      CLAUDE_PLUGIN_DATA: undefined
    });
    assert.equal(result.isError, false);
    const payload = parseToolText(result);
    const expected = fs.realpathSync.native(
      path.join(fixture.configDir, "plugins", "data", "cgo")
    );
    assert.equal(payload.pluginData, expected);
    const stat = fs.lstatSync(expected);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.mode & 0o777, 0o700);
    if (typeof process.getuid === "function") assert.equal(stat.uid, process.getuid());
  } finally {
    fixture.cleanup();
  }
});

test("a symlinked plugin data root is rejected before companion execution", () => {
  const fixture = makeFixture();
  try {
    const target = path.join(fixture.root, "target");
    const link = path.join(fixture.root, "plugin-data-link");
    fs.mkdirSync(target, { mode: 0o755 });
    fs.symlinkSync(target, link);
    const before = fs.statSync(target).mode & 0o777;
    const result = callTool("doctor", {}, {
      ...process.env,
      CLAUDE_CONFIG_DIR: fixture.configDir,
      CGO_PROJECT_DIR: fixture.projectDir,
      CGO_PLUGIN_DATA: link
    });
    assert.equal(result.isError, true);
    assert.match(parseToolText(result).error, /plugin data.*symbolic link/i);
    assert.equal(fs.statSync(target).mode & 0o777, before);
  } finally {
    fixture.cleanup();
  }
});
