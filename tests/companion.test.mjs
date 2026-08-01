import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  inspectOfficialCompanion,
  resolveOfficialCompanion
} from "../plugins/cgo/server/companion.mjs";
import { makeFixture } from "./helpers.mjs";

test("resolves the installed official companion only inside its cache boundary", () => {
  const fixture = makeFixture();
  try {
    const resolved = resolveOfficialCompanion({ configDir: fixture.configDir });
    assert.equal(resolved.path, fs.realpathSync(fixture.companionPath));
    assert.equal(resolved.version, "1.0.6");
    assert.equal(resolved.marketplace, "openai-codex");

    const report = inspectOfficialCompanion({ configDir: fixture.configDir });
    assert.equal(report.ok, true);
    assert.equal(report.compatible, true);
    assert.equal(report.minimumVersion, "1.0.6");
  } finally {
    fixture.cleanup();
  }
});

test("rejects a registry entry whose install path escapes the official cache", () => {
  const fixture = makeFixture({ installOutsideCache: true });
  try {
    assert.throws(
      () => resolveOfficialCompanion({ configDir: fixture.configDir }),
      /official.*cache|companion.*found/i
    );
  } finally {
    fixture.cleanup();
  }
});

test("doctor marks unsupported older versions without calling a model", () => {
  const fixture = makeFixture({ version: "1.0.5" });
  try {
    const report = inspectOfficialCompanion({ configDir: fixture.configDir });
    assert.equal(report.ok, true);
    assert.equal(report.compatible, false);
    assert.match(report.message, /1\.0\.6/);
  } finally {
    fixture.cleanup();
  }
});
