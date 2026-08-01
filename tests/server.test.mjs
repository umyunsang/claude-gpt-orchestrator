import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { makeFixture, parseResponses } from "./helpers.mjs";
import { callTool } from "../plugins/cgo/server/tools.mjs";

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

function dispatchArguments(overrides = {}) {
  return {
    role: "IMPLEMENTATION",
    brief: "Create only the approved fixture.",
    router_contract: "CGO_ROUTING_V2",
    decision_state: "CLEAR_SINGLE",
    write_intent: "EXPLICIT",
    workflow_id: null,
    sequence_index: 1,
    sequence_total: 1,
    ...overrides
  };
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
        arguments: dispatchArguments()
      }),
      request(4, "tools/call", {
        name: "status",
        arguments: {}
      }),
      request(5, "tools/call", {
        name: "status",
        arguments: { job_id: "task-fixture-123" }
      }),
      request(6, "tools/call", {
        name: "result",
        arguments: { job_id: "task-fixture-123" }
      }),
      request(7, "tools/call", {
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
        FAKE_CODEX_TRACE: fixture.tracePath,
        FAKE_CODEX_FOREGROUND_DELAY_MS: "5000"
      },
      encoding: "utf8",
      timeout: 2000,
      killSignal: "SIGTERM"
    });

    assert.equal(result.status, 0, result.stderr);
    const responses = parseResponses(result.stdout);
    assert.equal(responses.length, 7);
    assert.equal(responses[0].result.serverInfo.name, "cgo");

    const tools = responses[1].result.tools;
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["dispatch", "status", "result", "doctor"]
    );
    const delegateSchema = tools[0].inputSchema;
    assert.deepEqual(delegateSchema.required, [
      "role",
      "brief",
      "router_contract",
      "decision_state",
      "write_intent",
      "workflow_id",
      "sequence_index",
      "sequence_total"
    ]);
    assert.equal(delegateSchema.additionalProperties, false);
    assert.equal(responses[2].result.isError, false);
    const dispatchReceipt = JSON.parse(responses[2].result.content[0].text);
    assert.equal(dispatchReceipt.jobId, "task-fixture-123");
    assert.equal(dispatchReceipt.routerContract, "CGO_ROUTING_V2");
    assert.equal(dispatchReceipt.classifierProvenance, "CURRENT_CLAUDE_MODEL_SEMANTIC");
    assert.equal(dispatchReceipt.confidenceProvenance, "NONE");
    assert.equal(dispatchReceipt.decisionState, "CLEAR_SINGLE");
    assert.equal(dispatchReceipt.writeIntent, "EXPLICIT");
    assert.equal(dispatchReceipt.workflowId, null);
    assert.equal(dispatchReceipt.sequenceIndex, 1);
    assert.equal(dispatchReceipt.sequenceTotal, 1);
    assert.equal(dispatchReceipt.execution, "background");
    assert.equal(dispatchReceipt.officialStatus, "queued");
    assert.equal(dispatchReceipt.codexThreadId, null);
    assert.doesNotMatch(JSON.stringify(dispatchReceipt), /Create only the approved fixture/);
    assert.match(responses[3].result.content[0].text, /completed/);
    assert.equal(responses[4].result.isError, false);
    assert.match(responses[4].result.content[0].text, /task-fixture-123/);
    assert.match(responses[5].result.content[0].text, /session-fixture-123/);
    const resultReceipt = JSON.parse(responses[5].result.content[0].text);
    assert.deepEqual(resultReceipt.receiptRedactions, ["storedJob.request.prompt"]);
    assert.equal(resultReceipt.receipt.storedJob.request.model, "gpt-5.6-sol");
    assert.doesNotMatch(
      responses[5].result.content[0].text,
      /PRIVATE_SPECIALIST_PROMPT_SENTINEL/,
      "result receipts must not duplicate persisted prompts into the Claude transcript"
    );
    assert.match(responses[6].result.content[0].text, /1\.0\.6/);

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
    assert.equal(trace[0].pluginData, fs.realpathSync.native(fixture.pluginData));
    assert.deepEqual(trace[0].args.slice(0, 8), [
      "--background",
      "--fresh",
      "--json",
      "--model",
      "gpt-5.6-sol",
      "--effort",
      "xhigh",
      "--write"
    ]);
    assert.equal(trace[1].args.includes("--json"), true);
    assert.deepEqual(trace[2].args, ["task-fixture-123", "--json"]);
    assert.equal(trace[3].args.includes("--json"), true);
  } finally {
    fixture.cleanup();
  }
});

test("a queued job whose worker is gone is surfaced as orphaned without rewriting state", () => {
  const fixture = makeFixture();
  try {
    const messages = [
      request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "fixture", version: "1.0.0" }
      }),
      request(2, "tools/call", {
        name: "status",
        arguments: { job_id: "task-fixture-123" }
      })
    ];
    const result = spawnSync(process.execPath, [serverPath], {
      input: `${messages.join("\n")}\n`,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: fixture.configDir,
        CGO_PROJECT_DIR: fixture.projectDir,
        CGO_PLUGIN_DATA: fixture.pluginData,
        FAKE_CODEX_ORPHANED: "1"
      },
      encoding: "utf8",
      timeout: 10000
    });

    assert.equal(result.status, 0, result.stderr);
    const responses = parseResponses(result.stdout);
    assert.equal(responses[1].result.isError, false);
    const receipt = JSON.parse(responses[1].result.content[0].text).receipt;
    assert.equal(receipt.job.status, "queued");
    assert.equal(receipt.job.effectiveStatus, "orphaned");
    assert.equal(receipt.job.orphanReason, "PROCESS_NOT_RUNNING");
  } finally {
    fixture.cleanup();
  }
});

test("exact-job status rejects an official receipt for a different job", () => {
  const fixture = makeFixture();
  try {
    const messages = [
      request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "fixture", version: "1.0.0" }
      }),
      request(2, "tools/call", {
        name: "status",
        arguments: { job_id: "task-fixture-123" }
      })
    ];
    const result = spawnSync(process.execPath, [serverPath], {
      input: `${messages.join("\n")}\n`,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: fixture.configDir,
        CGO_PROJECT_DIR: fixture.projectDir,
        CGO_PLUGIN_DATA: fixture.pluginData,
        FAKE_CODEX_STATUS_JOB_ID: "task-different-456"
      },
      encoding: "utf8",
      timeout: 10000
    });
    assert.equal(result.status, 0, result.stderr);
    const responses = parseResponses(result.stdout);
    assert.equal(responses[1].result.isError, true);
    assert.match(responses[1].result.content[0].text, /does not match the requested job/i);
  } finally {
    fixture.cleanup();
  }
});

test("exact-job result rejects prefixes and mismatched official identities", () => {
  const cases = [
    {
      arguments: { job_id: "task-fixture" },
      env: {
        FAKE_CODEX_RESULT_JOB_ID: "task-fixture-123",
        FAKE_CODEX_STORED_JOB_ID: "task-fixture-123"
      }
    },
    {
      arguments: { job_id: "task-fixture-123" },
      env: {
        FAKE_CODEX_RESULT_JOB_ID: "task-fixture-123",
        FAKE_CODEX_STORED_JOB_ID: "task-different-456"
      }
    }
  ];

  for (const fixtureCase of cases) {
    const fixture = makeFixture();
    try {
      const messages = [
        request(1, "initialize", {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "fixture", version: "1.0.0" }
        }),
        request(2, "tools/call", {
          name: "result",
          arguments: fixtureCase.arguments
        })
      ];
      const result = spawnSync(process.execPath, [serverPath], {
        input: `${messages.join("\n")}\n`,
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: fixture.configDir,
          CGO_PROJECT_DIR: fixture.projectDir,
          CGO_PLUGIN_DATA: fixture.pluginData,
          ...fixtureCase.env
        },
        encoding: "utf8",
        timeout: 10000
      });
      assert.equal(result.status, 0, result.stderr);
      const responses = parseResponses(result.stdout);
      assert.equal(responses[1].result.isError, true);
      assert.match(
        responses[1].result.content[0].text,
        /does not match the requested job|job identities do not match/i
      );
      assert.doesNotMatch(responses[1].result.content[0].text, /implementation completed/);
    } finally {
      fixture.cleanup();
    }
  }
});

test("CLEAR_MULTI dispatches preserve one workflow id and explicit sequence positions", () => {
  const fixture = makeFixture();
  try {
    const workflow = "cgo-workflow-review-fix-1";
    const messages = [
      request(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "fixture", version: "1.0.0" }
      }),
      request(2, "tools/call", {
        name: "dispatch",
        arguments: dispatchArguments({
          role: "REVIEW",
          brief: "Review only.",
          decision_state: "CLEAR_MULTI",
          write_intent: "ABSENT",
          workflow_id: workflow,
          sequence_index: 1,
          sequence_total: 2
        })
      }),
      request(3, "tools/call", {
        name: "dispatch",
        arguments: dispatchArguments({
          brief: "Apply only confirmed findings.",
          decision_state: "CLEAR_MULTI",
          workflow_id: workflow,
          sequence_index: 2,
          sequence_total: 2
        })
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
    const review = JSON.parse(responses[1].result.content[0].text);
    const implementation = JSON.parse(responses[2].result.content[0].text);
    assert.deepEqual(
      [review.workflowId, review.sequenceIndex, review.sequenceTotal, review.mutationPolicy],
      [workflow, 1, 2, "read-only"]
    );
    assert.deepEqual(
      [implementation.workflowId, implementation.sequenceIndex, implementation.sequenceTotal, implementation.mutationPolicy],
      [workflow, 2, 2, "workspace-write"]
    );
    assert.equal(fs.readFileSync(fixture.tracePath, "utf8").trim().split("\n").length, 2);
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
        arguments: { role: "REVIEW", brief: "Review only." }
      }),
      request(3, "tools/call", {
        name: "dispatch",
        arguments: dispatchArguments({
          role: "REVIEW",
          brief: "Review only.",
          write_intent: "EXPLICIT"
        })
      }),
      request(4, "tools/call", {
        name: "dispatch",
        arguments: { ...dispatchArguments(), model: "gpt-5.6-terra" }
      }),
      request(5, "tools/call", {
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
    assert.match(responses[1].result.content[0].text, /CGO_METADATA_REQUIRED/);
    assert.equal(responses[2].result.isError, true);
    assert.match(responses[2].result.content[0].text, /CGO_READ_ONLY_ROLE_WRITE_CONFLICT/);
    assert.equal(responses[3].result.isError, true);
    assert.match(responses[3].result.content[0].text, /CGO_UNEXPECTED_FIELD/);
    assert.equal(responses[4].result.isError, true);
    assert.match(responses[4].result.content[0].text, /job_id/i);
    assert.equal(fs.existsSync(fixture.tracePath), false, "rejected calls must not launch the companion");
  } finally {
    fixture.cleanup();
  }
});

test("invalid routing metadata is rejected before companion discovery", () => {
  const fixture = makeFixture();
  try {
    fs.rmSync(path.join(fixture.configDir, "plugins", "installed_plugins.json"));
    const result = callTool("dispatch", { role: "REVIEW", brief: "Review only." }, {
      ...process.env,
      CLAUDE_CONFIG_DIR: fixture.configDir,
      CGO_PROJECT_DIR: fixture.projectDir,
      CGO_PLUGIN_DATA: fixture.pluginData
    });
    assert.equal(result.isError, true);
    assert.equal(JSON.parse(result.content[0].text).code, "CGO_METADATA_REQUIRED");
  } finally {
    fixture.cleanup();
  }
});
