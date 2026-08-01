import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { makeFixture, parseResponses } from "./helpers.mjs";

const serverPath = path.resolve(
  "plugins/cgo/server/server.mjs"
);

function request(id, method, params = undefined) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    ...(params === undefined ? {} : { params })
  });
}

test("MCP server exposes bounded tools and delegates through a fake official companion", () => {
  const fixture = makeFixture();
  try {
    const messages = [
      request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "fixture", version: "1.0.0" }
      }),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      request(2, "tools/list"),
      request(3, "tools/call", {
        name: "dispatch",
        arguments: { role: "IMPLEMENTATION", brief: "Create only the approved fixture." }
      }),
      request(4, "tools/call", {
        name: "status",
        arguments: {}
      }),
      request(5, "tools/call", {
        name: "result",
        arguments: { job_id: "task-fixture-123" }
      }),
      request(6, "tools/call", {
        name: "doctor",
        arguments: {}
      })
    ];

    const result = spawnSync(process.execPath, [serverPath], {
      input: `${messages.join("\n")}\n`,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: fixture.configDir,
        CGO_PROJECT_DIR: fixture.projectDir,
        CGO_PLUGIN_DATA: fixture.pluginData,
        FAKE_CODEX_TRACE: fixture.tracePath
      },
      encoding: "utf8",
      timeout: 10000
    });

    assert.equal(result.status, 0, result.stderr);
    const responses = parseResponses(result.stdout);
    assert.equal(responses.length, 6);
    assert.equal(responses[0].result.serverInfo.name, "cgo");

    const tools = responses[1].result.tools;
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["dispatch", "status", "result", "doctor"]
    );
    const delegateSchema = tools[0].inputSchema;
    assert.deepEqual(delegateSchema.required, ["role", "brief"]);
    assert.equal(delegateSchema.additionalProperties, false);
    assert.equal(responses[2].result.isError, false);
    assert.match(responses[2].result.content[0].text, /task-fixture-123/);
    assert.doesNotMatch(responses[2].result.content[0].text, /"read-only"\s*,/);
    assert.doesNotMatch(responses[2].result.content[0].text, /"code-review"\s*,/);
    assert.match(responses[3].result.content[0].text, /completed/);
    assert.match(responses[4].result.content[0].text, /session-fixture-123/);
    assert.match(responses[5].result.content[0].text, /1\.0\.6/);

    const trace = fs.readFileSync(fixture.tracePath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(trace.map((entry) => entry.command), [
      "task",
      "status",
      "status",
      "result"
    ]);
    assert.equal(trace[0].cwd, fs.realpathSync(fixture.projectDir));
    assert.equal(trace[0].pluginData, fixture.pluginData);
    assert.deepEqual(trace[0].args.slice(0, 7), [
      "--fresh",
      "--json",
      "--model",
      "gpt-5.6-sol",
      "--effort",
      "xhigh",
      "--write"
    ]);
    assert.equal(trace[1].args.includes("--json"), true);
    assert.equal(trace[2].args.includes("--json"), true);
    assert.equal(trace[3].args.includes("--json"), true);
  } finally {
    fixture.cleanup();
  }
});

test("MCP server rejects policy overrides and malformed job identifiers", () => {
  const fixture = makeFixture();
  try {
    const messages = [
      request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "fixture", version: "1.0.0" }
      }),
      request(2, "tools/call", {
        name: "dispatch",
        arguments: {
          role: "REVIEW",
          brief: "Review only.",
          model: "gpt-5.6-terra"
        }
      }),
      request(3, "tools/call", {
        name: "result",
        arguments: { job_id: "../../escape" }
      })
    ];
    const result = spawnSync(process.execPath, [serverPath], {
      input: `${messages.join("\n")}\n`,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: fixture.configDir,
        CGO_PROJECT_DIR: fixture.projectDir,
        CGO_PLUGIN_DATA: fixture.pluginData
      },
      encoding: "utf8",
      timeout: 10000
    });

    assert.equal(result.status, 0, result.stderr);
    const responses = parseResponses(result.stdout);
    assert.equal(responses[1].result.isError, true);
    assert.match(responses[1].result.content[0].text, /unexpected.*model/i);
    assert.equal(responses[2].result.isError, true);
    assert.match(responses[2].result.content[0].text, /job_id/i);
  } finally {
    fixture.cleanup();
  }
});
