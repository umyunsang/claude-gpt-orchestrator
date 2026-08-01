#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";

const [command, ...args] = process.argv.slice(2);
const trace = {
  command,
  args,
  cwd: process.cwd(),
  pluginData: process.env.CLAUDE_PLUGIN_DATA ?? null
};

if (process.env.FAKE_CODEX_TRACE) {
  fs.appendFileSync(process.env.FAKE_CODEX_TRACE, `${JSON.stringify(trace)}\n`, "utf8");
}

if (command === "task") {
  if (!args.includes("--json")) {
    process.stderr.write("task requires --json in the CGO fixture\n");
    process.exit(3);
  }
  process.stdout.write(JSON.stringify({
    status: 0,
    threadId: "session-fixture-123",
    rawOutput: "implementation completed for read-only code-review",
    touchedFiles: [],
    reasoningSummary: []
  }));
  process.stdout.write("\n");
  process.exit(0);
}

if (command === "status") {
  if (!args.includes("--json")) {
    process.stderr.write("status requires --json in the CGO fixture\n");
    process.exit(3);
  }
  process.stdout.write(JSON.stringify({
    workspaceRoot: process.cwd(),
    config: {},
    sessionRuntime: null,
    running: [],
    latestFinished: {
      id: "task-fixture-123",
      status: "completed",
      phase: "done",
      threadId: "session-fixture-123"
    },
    recent: [],
    needsReview: false
  }));
  process.stdout.write("\n");
  process.exit(0);
}

if (command === "result") {
  if (!args.includes("--json")) {
    process.stderr.write("result requires --json in the CGO fixture\n");
    process.exit(3);
  }
  process.stdout.write(JSON.stringify({
    job: {
      id: "task-fixture-123",
      status: "completed",
      threadId: "session-fixture-123"
    },
    storedJob: {
      id: "task-fixture-123",
      status: "completed",
      threadId: "session-fixture-123",
      result: {
        status: "completed",
        threadId: "session-fixture-123",
        rawOutput: "implementation completed for read-only code-review",
        touchedFiles: [],
        reasoningSummary: []
      }
    }
  }));
  process.stdout.write("\n");
  process.exit(0);
}

process.stderr.write(`unsupported fake command: ${command}\n`);
process.exit(2);
