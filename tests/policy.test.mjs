import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_MODEL,
  buildTaskInvocation,
  resolveRoleContract
} from "../plugins/cgo/server/policy.mjs";

test("role contracts fix model, effort, and mutation policy", () => {
  assert.equal(REQUIRED_MODEL, "gpt-5.6-sol");
  assert.deepEqual(resolveRoleContract("IMPLEMENTATION"), {
    role: "IMPLEMENTATION",
    model: "gpt-5.6-sol",
    effort: "xhigh",
    write: true
  });

  for (const role of ["DEEP_RESEARCH", "WEB_RESEARCH", "REVIEW", "QA"]) {
    assert.deepEqual(resolveRoleContract(role), {
      role,
      model: "gpt-5.6-sol",
      effort: "high",
      write: false
    });
  }

  assert.throws(() => resolveRoleContract("PLANNING"), /unsupported role/i);
});

test("task invocation is fresh foreground and exposes no policy override", () => {
  const invocation = buildTaskInvocation({
    role: "IMPLEMENTATION",
    brief: "Implement the approved fixture.",
    companionPath: "/safe/codex-companion.mjs"
  });

  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args.slice(0, 8), [
    "/safe/codex-companion.mjs",
    "task",
    "--fresh",
    "--json",
    "--model",
    "gpt-5.6-sol",
    "--effort",
    "xhigh"
  ]);
  assert.ok(invocation.args.includes("--write"));
  assert.equal(invocation.args.includes("--background"), false);
  assert.equal(invocation.args.includes("--resume"), false);
  assert.match(invocation.args.at(-1), /ROLE=IMPLEMENTATION/);
  assert.match(invocation.args.at(-1), /Implement the approved fixture/);
});

test("brief validation rejects empty and oversized prompts", () => {
  assert.throws(
    () => buildTaskInvocation({ role: "QA", brief: " ", companionPath: "/safe/codex-companion.mjs" }),
    /brief.*required/i
  );
  assert.throws(
    () => buildTaskInvocation({
      role: "QA",
      brief: "x".repeat(120001),
      companionPath: "/safe/codex-companion.mjs"
    }),
    /120000/
  );
});
