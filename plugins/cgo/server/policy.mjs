import process from "node:process";

export const REQUIRED_MODEL = "gpt-5.6-sol";
export const MAX_BRIEF_LENGTH = 120000;
export const ROUTER_CONTRACT = "CGO_ROUTING_V2";
export const CLASSIFIER_PROVENANCE = "CURRENT_CLAUDE_MODEL_SEMANTIC";
export const CONFIDENCE_PROVENANCE = "NONE";
export const ROLE_ENUM = Object.freeze([
  "IMPLEMENTATION",
  "DEEP_RESEARCH",
  "WEB_RESEARCH",
  "REVIEW",
  "QA"
]);
export const DECISION_STATE_ENUM = Object.freeze([
  "CLEAR_SINGLE",
  "CLEAR_MULTI",
  "AMBIGUOUS",
  "OOS_UNKNOWN"
]);
export const WRITE_INTENT_ENUM = Object.freeze([
  "EXPLICIT",
  "ABSENT",
  "CONFLICTING"
]);

const DISPATCH_KEYS = Object.freeze([
  "role",
  "brief",
  "router_contract",
  "decision_state",
  "write_intent",
  "workflow_id",
  "sequence_index",
  "sequence_total"
]);
const WORKFLOW_ID_PATTERN = /^cgo-workflow-[a-z0-9][a-z0-9-]{0,114}$/;
const VALIDATED = Symbol("validated-cgo-dispatch");

const ROLE_CONTRACTS = Object.freeze({
  IMPLEMENTATION: Object.freeze({ effort: "xhigh", write: true }),
  DEEP_RESEARCH: Object.freeze({ effort: "high", write: false }),
  WEB_RESEARCH: Object.freeze({ effort: "high", write: false }),
  REVIEW: Object.freeze({ effort: "high", write: false }),
  QA: Object.freeze({ effort: "high", write: false })
});

export class CgoPolicyError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "CgoPolicyError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new CgoPolicyError(code, message);
}

export function resolveRoleContract(role) {
  const policy = ROLE_CONTRACTS[role];
  if (!policy) {
    fail("CGO_ROLE_UNSUPPORTED", `Expected one of: ${ROLE_ENUM.join(", ")}.`);
  }
  return {
    role,
    model: REQUIRED_MODEL,
    effort: policy.effort,
    write: policy.write
  };
}

function normalizeBrief(brief) {
  if (typeof brief !== "string" || !brief.trim()) {
    fail("CGO_BRIEF_INVALID", "A non-empty specialist brief is required.");
  }
  const normalized = brief.trim();
  if (normalized.length > MAX_BRIEF_LENGTH) {
    fail("CGO_BRIEF_INVALID", `The specialist brief exceeds ${MAX_BRIEF_LENGTH} characters.`);
  }
  return normalized;
}

function validateExactDispatchObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("CGO_METADATA_REQUIRED", "Dispatch requires the complete CGO_ROUTING_V2 metadata object.");
  }
  const unexpected = Object.keys(input).filter((key) => !DISPATCH_KEYS.includes(key));
  if (unexpected.length > 0) {
    fail("CGO_UNEXPECTED_FIELD", `Unexpected dispatch field(s): ${unexpected.join(", ")}.`);
  }
  const missing = DISPATCH_KEYS.filter((key) => !Object.hasOwn(input, key));
  if (missing.length > 0) {
    fail("CGO_METADATA_REQUIRED", `Missing dispatch field(s): ${missing.join(", ")}.`);
  }
}

function validateSequence(input) {
  if (!Number.isInteger(input.sequence_index) || !Number.isInteger(input.sequence_total)) {
    fail("CGO_SEQUENCE_INVALID", "Sequence index and total must be integers.");
  }
  if (input.decision_state === "CLEAR_SINGLE") {
    if (input.workflow_id !== null || input.sequence_index !== 1 || input.sequence_total !== 1) {
      fail("CGO_SEQUENCE_INVALID", "CLEAR_SINGLE requires workflow_id=null and sequence 1/1.");
    }
    return;
  }
  if (typeof input.workflow_id !== "string" || !WORKFLOW_ID_PATTERN.test(input.workflow_id)) {
    fail("CGO_WORKFLOW_INVALID", "CLEAR_MULTI requires a safe cgo-workflow identifier.");
  }
  if (
    input.sequence_total < 2 ||
    input.sequence_total > 5 ||
    input.sequence_index < 1 ||
    input.sequence_index > input.sequence_total
  ) {
    fail("CGO_SEQUENCE_INVALID", "CLEAR_MULTI requires total 2..5 and index 1..total.");
  }
}

export function validateDispatchRequest(input) {
  validateExactDispatchObject(input);
  if (input.router_contract !== ROUTER_CONTRACT) {
    fail("CGO_CONTRACT_UNSUPPORTED", `router_contract must be ${ROUTER_CONTRACT}.`);
  }
  if (!DECISION_STATE_ENUM.includes(input.decision_state)) {
    fail("CGO_DECISION_INVALID", `Unsupported decision_state: ${String(input.decision_state)}.`);
  }
  if (["AMBIGUOUS", "OOS_UNKNOWN"].includes(input.decision_state)) {
    fail("CGO_DECISION_NOT_DISPATCHABLE", `${input.decision_state} cannot dispatch a specialist.`);
  }
  if (!WRITE_INTENT_ENUM.includes(input.write_intent)) {
    fail("CGO_WRITE_INTENT_INVALID", `Unsupported write_intent: ${String(input.write_intent)}.`);
  }

  const contract = resolveRoleContract(input.role);
  validateSequence(input);
  if (contract.write && input.write_intent !== "EXPLICIT") {
    fail("CGO_WRITE_INTENT_REQUIRED", "IMPLEMENTATION requires write_intent=EXPLICIT.");
  }
  if (!contract.write && input.write_intent !== "ABSENT") {
    fail(
      "CGO_READ_ONLY_ROLE_WRITE_CONFLICT",
      `${input.role} requires write_intent=ABSENT and cannot request writes.`
    );
  }

  return Object.freeze({
    [VALIDATED]: true,
    role: input.role,
    brief: normalizeBrief(input.brief),
    routerContract: input.router_contract,
    decisionState: input.decision_state,
    writeIntent: input.write_intent,
    workflowId: input.workflow_id,
    sequenceIndex: input.sequence_index,
    sequenceTotal: input.sequence_total,
    contract
  });
}

export function buildTaskInvocation({ request, companionPath }) {
  if (typeof companionPath !== "string" || !companionPath) {
    fail("CGO_COMPANION_REQUIRED", "The official Codex companion path is required.");
  }
  if (!request?.[VALIDATED]) {
    fail("CGO_METADATA_REQUIRED", "Task invocation requires validated CGO routing metadata.");
  }

  const { contract } = request;
  const mutationContract = contract.write
    ? "WRITE-CAPABLE only inside the user-approved current project scope. Preserve unrelated changes."
    : `READ-ONLY ${request.role}. Do not modify source, configuration, credentials, accounts, or services.`;
  const taskPrompt = [
    `[ROLE=${request.role}]`,
    `ROUTER_CONTRACT=${request.routerContract}`,
    `DECISION_STATE=${request.decisionState}`,
    `WRITE_INTENT=${request.writeIntent}`,
    `WORKFLOW_ID=${request.workflowId ?? "NONE"}`,
    `SEQUENCE=${request.sequenceIndex}/${request.sequenceTotal}`,
    mutationContract,
    "Work only from this self-contained brief.",
    "Return evidence, exact checks, touched files, remaining risks, and a concise verdict.",
    request.brief
  ].join("\n");

  const args = [
    companionPath,
    "task",
    "--background",
    "--fresh",
    "--json",
    "--model",
    REQUIRED_MODEL,
    "--effort",
    contract.effort
  ];
  if (contract.write) args.push("--write");
  args.push("--", taskPrompt);

  return {
    command: process.execPath,
    args,
    contract,
    routing: request,
    taskPrompt
  };
}
