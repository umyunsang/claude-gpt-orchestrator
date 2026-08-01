import process from "node:process";

export const REQUIRED_MODEL = "gpt-5.6-sol";
export const MAX_BRIEF_LENGTH = 120000;

const ROLE_CONTRACTS = Object.freeze({
  IMPLEMENTATION: Object.freeze({ effort: "xhigh", write: true }),
  DEEP_RESEARCH: Object.freeze({ effort: "high", write: false }),
  WEB_RESEARCH: Object.freeze({ effort: "high", write: false }),
  REVIEW: Object.freeze({ effort: "high", write: false }),
  QA: Object.freeze({ effort: "high", write: false })
});

export function resolveRoleContract(role) {
  const policy = ROLE_CONTRACTS[role];
  if (!policy) {
    throw new Error(
      `Unsupported role. Expected one of: ${Object.keys(ROLE_CONTRACTS).join(", ")}.`
    );
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
    throw new Error("A non-empty specialist brief is required.");
  }
  const normalized = brief.trim();
  if (normalized.length > MAX_BRIEF_LENGTH) {
    throw new Error(`The specialist brief exceeds ${MAX_BRIEF_LENGTH} characters.`);
  }
  return normalized;
}

export function buildTaskInvocation({ role, brief, companionPath }) {
  if (typeof companionPath !== "string" || !companionPath) {
    throw new Error("The official Codex companion path is required.");
  }

  const contract = resolveRoleContract(role);
  const normalizedBrief = normalizeBrief(brief);
  const mutationContract = contract.write
    ? "WRITE-CAPABLE only inside the user-approved current project scope. Preserve unrelated changes."
    : `READ-ONLY ${role}. Do not modify source, configuration, credentials, accounts, or services.`;
  const taskPrompt = [
    `[ROLE=${role}]`,
    mutationContract,
    "Work only from this self-contained brief.",
    "Return evidence, exact checks, touched files, remaining risks, and a concise verdict.",
    normalizedBrief
  ].join("\n");

  const args = [
    companionPath,
    "task",
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
    taskPrompt
  };
}
