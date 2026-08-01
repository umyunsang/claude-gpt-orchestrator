import assert from "node:assert/strict";
import test from "node:test";

import {
  extractStructuredJobIds,
  parseStructuredOutput
} from "../plugins/cgo/server/runner.mjs";

test("structured receipt parsing never infers job ids from model prose", () => {
  const payload = parseStructuredOutput(JSON.stringify({
    status: 0,
    threadId: "session-fixture-123",
    rawOutput: "implementation completed for read-only code-review",
    touchedFiles: []
  }), "task");

  assert.deepEqual(extractStructuredJobIds(payload), []);
});

test("official task receipts use numeric 0/1 execution status", () => {
  const base = {
    threadId: "session-fixture-123",
    rawOutput: "done",
    touchedFiles: []
  };

  assert.equal(
    parseStructuredOutput(JSON.stringify({ ...base, status: 0 }), "task").status,
    0
  );
  assert.equal(
    parseStructuredOutput(JSON.stringify({ ...base, status: 1 }), "task").status,
    1
  );
  assert.throws(
    () => parseStructuredOutput(JSON.stringify({ ...base, status: "completed" }), "task"),
    /task.*status.*0 or 1/i
  );
  assert.throws(
    () => parseStructuredOutput(JSON.stringify({ ...base, status: 2 }), "task"),
    /task.*status.*0 or 1/i
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

test("malformed structured companion output is rejected", () => {
  assert.throws(
    () => parseStructuredOutput("not json", "status"),
    /status.*valid JSON/i
  );
});
