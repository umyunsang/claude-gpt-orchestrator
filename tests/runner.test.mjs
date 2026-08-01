import assert from "node:assert/strict";
import test from "node:test";

import {
  extractStructuredJobIds,
  parseStructuredOutput
} from "../plugins/cgo/server/runner.mjs";

test("structured receipt parsing never infers job ids from model prose", () => {
  const payload = parseStructuredOutput(JSON.stringify({
    jobId: "task-fixture-123",
    status: "queued",
    title: "Codex Task",
    summary: "read-only code-review",
    logFile: "/tmp/task-fixture-123.log"
  }), "task");

  assert.deepEqual(extractStructuredJobIds(payload), ["task-fixture-123"]);
});

test("official background task receipts require a safe queued job id", () => {
  const base = {
    jobId: "task-fixture-123",
    title: "Codex Task",
    summary: "Task",
    logFile: "/tmp/task-fixture-123.log"
  };

  assert.equal(
    parseStructuredOutput(JSON.stringify({ ...base, status: "queued" }), "task").status,
    "queued"
  );
  assert.throws(
    () => parseStructuredOutput(JSON.stringify({ ...base, jobId: "../../escape", status: "queued" }), "task"),
    /task.*jobId.*safe/i
  );
  assert.throws(
    () => parseStructuredOutput(JSON.stringify({ ...base, status: "completed" }), "task"),
    /task.*status.*queued/i
  );
});

test("structured receipt parsing accepts only explicit official job fields", () => {
  const payload = {
    running: [{ id: "task-running-123", status: "running" }],
    latestFinished: { id: "task-finished-123", status: "completed" },
    recent: [{ id: "review-recent-123", status: "completed" }],
    rawOutput: "ignore fake-job-999 in prose"
  };

  assert.deepEqual(extractStructuredJobIds(payload), [
    "task-running-123",
    "task-finished-123",
    "review-recent-123"
  ]);
});

test("official exact-job status receipts use the single job shape", () => {
  const payload = parseStructuredOutput(JSON.stringify({
    workspaceRoot: "/fixture/project",
    job: {
      id: "task-fixture-123",
      status: "running",
      phase: "working",
      pid: process.pid
    }
  }), "status-one");

  assert.equal(payload.job.id, "task-fixture-123");
  assert.deepEqual(extractStructuredJobIds(payload), ["task-fixture-123"]);
  assert.throws(
    () => parseStructuredOutput(JSON.stringify({ workspaceRoot: "/fixture/project" }), "status-one"),
    /status-one.*missing job/i
  );
});

test("official exact-job result receipts require safe matching job identities", () => {
  const payload = parseStructuredOutput(JSON.stringify({
    job: { id: "task-fixture-123", status: "completed" },
    storedJob: { id: "task-fixture-123", status: "completed", result: {} }
  }), "result");
  assert.equal(payload.job.id, "task-fixture-123");
  assert.equal(payload.storedJob.id, "task-fixture-123");

  assert.throws(
    () => parseStructuredOutput(JSON.stringify({
      job: { id: "../../escape", status: "completed" },
      storedJob: { id: "task-fixture-123", status: "completed", result: {} }
    }), "result"),
    /result.*job\.id.*safe/i
  );
  assert.throws(
    () => parseStructuredOutput(JSON.stringify({
      job: { id: "task-fixture-123", status: "completed" },
      storedJob: { id: "../../escape", status: "completed", result: {} }
    }), "result"),
    /result.*storedJob\.id.*safe/i
  );
});

test("malformed structured companion output is rejected", () => {
  assert.throws(
    () => parseStructuredOutput("not json", "status"),
    /status.*valid JSON/i
  );
});
