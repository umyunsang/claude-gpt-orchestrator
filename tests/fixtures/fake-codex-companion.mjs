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
  if (!args.includes("--background")) {
    const delayMs = Number(process.env.FAKE_CODEX_FOREGROUND_DELAY_MS || 0);
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    process.stdout.write(JSON.stringify({
      status: 0,
      threadId: "session-fixture-123",
      rawOutput: "foreground completion",
      touchedFiles: [],
      reasoningSummary: []
    }));
    process.stdout.write("\n");
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({
    jobId: "task-fixture-123",
    status: "queued",
    title: "Codex Task",
    summary: "Task",
    logFile: "/tmp/task-fixture-123.log"
  }));
  process.stdout.write("\n");
  process.exit(0);
}

if (command === "status") {
  if (!args.includes("--json")) {
    process.stderr.write("status requires --json in the CGO fixture\n");
    process.exit(3);
  }
  const reference = args.find((argument) => !argument.startsWith("--"));
  const orphaned = process.env.FAKE_CODEX_ORPHANED === "1";
  const payload = reference
    ? {
        workspaceRoot: process.cwd(),
        job: {
          id: process.env.FAKE_CODEX_STATUS_JOB_ID || reference,
          status: orphaned ? "queued" : "completed",
          phase: orphaned ? "queued" : "done",
          pid: orphaned ? 2147483647 : null,
          threadId: orphaned ? null : "session-fixture-123"
        }
      }
    : {
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
      };
  process.stdout.write(JSON.stringify(payload));
  process.stdout.write("\n");
  process.exit(0);
}

if (command === "result") {
  if (!args.includes("--json")) {
    process.stderr.write("result requires --json in the CGO fixture\n");
    process.exit(3);
  }
  const requestedJobId = args.find((argument) => !argument.startsWith("--"));
  const resultJobId = process.env.FAKE_CODEX_RESULT_JOB_ID || requestedJobId;
  const storedJobId = process.env.FAKE_CODEX_STORED_JOB_ID || resultJobId;
  process.stdout.write(JSON.stringify({
    job: {
      id: resultJobId,
      status: "completed",
      threadId: "session-fixture-123"
    },
    storedJob: {
      id: storedJobId,
      status: "completed",
      threadId: "session-fixture-123",
      request: {
        prompt: "PRIVATE_SPECIALIST_PROMPT_SENTINEL",
        model: "gpt-5.6-sol",
        effort: "high"
      },
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
