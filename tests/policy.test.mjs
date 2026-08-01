import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASSIFIER_PROVENANCE,
  CONFIDENCE_PROVENANCE,
  REQUIRED_MODEL,
  ROUTER_CONTRACT,
  buildTaskInvocation,
  resolveRoleContract,
  validateDispatchRequest
} from "../plugins/cgo/server/policy.mjs";

function request(overrides = {}) {
  return {
    role: "IMPLEMENTATION",
    brief: "Implement only the approved fixture.",
    router_contract: "CGO_ROUTING_V2",
    decision_state: "CLEAR_SINGLE",
    write_intent: "EXPLICIT",
    workflow_id: null,
    sequence_index: 1,
    sequence_total: 1,
    ...overrides
  };
}

function expectCode(input, code) {
  assert.throws(
    () => validateDispatchRequest(input),
    (error) => error?.code === code,
    `expected ${code}`
  );
}

test("role contracts and routing provenance are fixed", () => {
  assert.equal(REQUIRED_MODEL, "gpt-5.6-sol");
  assert.equal(ROUTER_CONTRACT, "CGO_ROUTING_V2");
  assert.equal(CLASSIFIER_PROVENANCE, "CURRENT_CLAUDE_MODEL_SEMANTIC");
  assert.equal(CONFIDENCE_PROVENANCE, "NONE");
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
});

test("valid single and multi dispatch metadata is normalized", () => {
  const single = validateDispatchRequest(request());
  assert.equal(single.workflowId, null);
  assert.equal(single.sequenceIndex, 1);
  assert.equal(single.contract.write, true);

  const multi = validateDispatchRequest(request({
    role: "REVIEW",
    brief: "Review only.",
    decision_state: "CLEAR_MULTI",
    write_intent: "ABSENT",
    workflow_id: "cgo-workflow-review-fix-1",
    sequence_index: 1,
    sequence_total: 2
  }));
  assert.equal(multi.workflowId, "cgo-workflow-review-fix-1");
  assert.equal(multi.contract.write, false);
});

test("metadata, abstention, false-write, and sequence failures have stable codes", () => {
  expectCode(undefined, "CGO_METADATA_REQUIRED");
  expectCode({ role: "REVIEW", brief: "Review only." }, "CGO_METADATA_REQUIRED");
  expectCode(request({ router_contract: "CGO_ROUTING_V1" }), "CGO_CONTRACT_UNSUPPORTED");
  expectCode(request({ decision_state: "AMBIGUOUS" }), "CGO_DECISION_NOT_DISPATCHABLE");
  expectCode(request({ decision_state: "OOS_UNKNOWN" }), "CGO_DECISION_NOT_DISPATCHABLE");
  expectCode(request({ write_intent: "ABSENT" }), "CGO_WRITE_INTENT_REQUIRED");
  expectCode(request({ write_intent: "CONFLICTING" }), "CGO_WRITE_INTENT_REQUIRED");
  expectCode(request({ role: "REVIEW", write_intent: "EXPLICIT" }), "CGO_READ_ONLY_ROLE_WRITE_CONFLICT");
  expectCode(request({ role: "QA", write_intent: "CONFLICTING" }), "CGO_READ_ONLY_ROLE_WRITE_CONFLICT");
  expectCode(request({ workflow_id: "cgo-workflow-not-single" }), "CGO_SEQUENCE_INVALID");
  expectCode(request({ decision_state: "CLEAR_MULTI", workflow_id: null, sequence_total: 2 }), "CGO_WORKFLOW_INVALID");
  expectCode(request({ decision_state: "CLEAR_MULTI", workflow_id: "../../escape", sequence_total: 2 }), "CGO_WORKFLOW_INVALID");
  expectCode(request({ decision_state: "CLEAR_MULTI", workflow_id: "cgo-workflow-x", sequence_index: 0, sequence_total: 2 }), "CGO_SEQUENCE_INVALID");
  expectCode(request({ decision_state: "CLEAR_MULTI", workflow_id: "cgo-workflow-x", sequence_index: 3, sequence_total: 2 }), "CGO_SEQUENCE_INVALID");
  expectCode(request({ decision_state: "CLEAR_MULTI", workflow_id: "cgo-workflow-x", sequence_index: 1, sequence_total: 6 }), "CGO_SEQUENCE_INVALID");
  expectCode({ ...request(), model: "gpt-5.6-terra" }, "CGO_UNEXPECTED_FIELD");
});

test("task invocation is fixed and only validated implementation receives write", () => {
  const implementation = buildTaskInvocation({
    request: validateDispatchRequest(request()),
    companionPath: "/safe/codex-companion.mjs"
  });
  assert.deepEqual(implementation.args.slice(0, 9), [
    "/safe/codex-companion.mjs",
    "task",
    "--background",
    "--fresh",
    "--json",
    "--model",
    "gpt-5.6-sol",
    "--effort",
    "xhigh"
  ]);
  assert.equal(implementation.args.filter((arg) => arg === "--write").length, 1);
  assert.match(implementation.taskPrompt, /ROUTER_CONTRACT=CGO_ROUTING_V2/);
  assert.match(implementation.taskPrompt, /WRITE_INTENT=EXPLICIT/);

  const review = buildTaskInvocation({
    request: validateDispatchRequest(request({
      role: "REVIEW",
      brief: "Review only.",
      write_intent: "ABSENT"
    })),
    companionPath: "/safe/codex-companion.mjs"
  });
  assert.equal(review.args.includes("--write"), false);
  assert.equal(review.contract.write, false);
});
