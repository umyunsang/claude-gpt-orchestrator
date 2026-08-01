#!/usr/bin/env node

import process from "node:process";

const input = await new Promise((resolve, reject) => {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    data += chunk;
  });
  process.stdin.on("end", () => resolve(data));
  process.stdin.on("error", reject);
});

let payload;
try {
  payload = JSON.parse(input || "{}");
} catch {
  process.exit(0);
}

const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
if (!prompt || /^\s*\/(?:codex|cgo):/i.test(prompt)) process.exit(0);

const matchesText = (text, patterns) => patterns.some((pattern) => pattern.test(text));
const matches = (patterns) => matchesText(prompt, patterns);

const asksForPlan = matches([
  /계획/, /설계/, /아키텍처/, /기획/, /전략/, /추론/,
  /\bplan(?:ning)?\b/i, /\bdesign\b/i, /\barchitecture\b/i,
  /\breason(?:ing)?\b/i
]);
const rawImplementation = matches([
  /구현/, /개발/, /코딩/, /코드\s*작성/, /구축/, /기능\s*(?:추가|개발)/,
  /(?:버그|오류|문제).{0,12}(?:수정|고쳐|해결)/, /수정해/, /고쳐/, /리팩터/,
  /\bimplement(?:ation)?\b/i, /\bdevelop(?:ment)?\b/i, /\bfix\b/i,
  /\brefactor\b/i, /\bbuild\b/i
]);
const explicitReadOnly = matches([
  /읽기\s*전용/, /수정하지\s*(?:마|말)/, /변경하지\s*(?:마|말)/,
  /구현하지\s*(?:마|말)/, /적용하지\s*(?:마|말)/, /검토만/, /리뷰만/,
  /\bread[- ]?only\b/i, /\bdo not\s+(?:modify|edit|implement|change|apply)\b/i,
  /\b(?:review|findings)\s+only\b/i, /\bno\s+(?:changes|edits|writes)\b/i
]);
const writeActionProbe = prompt
  .replace(/\b(?:do\s+not|don't|never)\b[^.!?;\n]{0,80}\b(?:implement|develop|fix|modify|edit|apply)\b[^.!?;\n]*/gi, " ")
  .replace(/(?:구현|개발|코딩|수정|변경|적용)(?:하지|하진|하지는|하지도)\s*(?:마|말|않)[^.!?;\n]*/g, " ")
  .replace(/(?:구현|개발|코딩|수정|변경|적용)\s*(?:금지|없이)/g, " ");
const explicitWriteAction = matchesText(writeActionProbe, [
  /(?:실제로|직접)?\s*(?:구현|개발|코딩|수정|변경|적용)(?:을|를|도|까지)?\s*(?:진행해|진행해줘|해주세요|해줘|해|적용해|작성해|만들어)/,
  /(?:문제|버그|코드|파일)(?:을|를)?\s*(?:고쳐|수정해|변경해|적용해)/,
  /(?:^|[.!?;\n]|\b(?:then|and)\b)\s*(?:please\s+)?(?:implement|develop|fix|modify|edit|apply)\b/i
]);
const implementationAsAssessmentTarget = matches([
  /(?:구현|개발|구축|코드|변경(?:사항)?|수정).{0,24}(?:리뷰|검토|감사|qa|테스트|시험|회귀|검증)/i,
  /(?:리뷰|검토|감사|qa|테스트|시험|회귀|검증).{0,24}(?:구현|개발|구축|코드|변경(?:사항)?|수정)/i,
  /\b(?:implementation|development|build|code|changes?|fix)\b.{0,32}\b(?:review|audit|qa|tests?|testing|verification|validation)\b/i,
  /\b(?:review|audit|qa|tests?|testing|verification|validation)\b.{0,32}\b(?:implementation|development|build|code|changes?|fix)\b/i
]);
const asksForImplementation = rawImplementation &&
  (!explicitReadOnly || explicitWriteAction) &&
  (!implementationAsAssessmentTarget || explicitWriteAction);
const asksForResearch = matches([
  /딥\s*리서치/, /심층\s*(?:조사|연구)/, /자료\s*조사/, /문헌\s*조사/,
  /검증된\s*자료/, /근거.{0,12}찾/, /\bresearch\b/i, /\bdeep[- ]?research\b/i
]);
const asksForWebResearch = matches([
  /웹\s*(?:리서치|조사|검색)/, /웹에서.{0,20}(?:조사|검색|찾)/,
  /인터넷에서?.{0,20}(?:조사|검색|찾)/, /온라인\s*(?:리서치|조사|검색)/,
  /\bweb[- ]?research\b/i, /\bonline[- ]?research\b/i,
  /\b(?:browse|search)\s+(?:the\s+)?web\b/i
]);
const asksForReview = matches([
  /코드\s*리뷰/, /변경(?:사항)?\s*리뷰/, /리뷰/, /검토/, /감사/,
  /\breview\b/i, /\baudit\b/i
]);
const rawQa = matches([
  /\bqa\b/i, /품질\s*(?:검증|보증)/, /테스트/, /시험/, /회귀/, /검증/,
  /\btest(?:ing)?\b/i, /\bverify\b/i, /\bvalidation\b/i
]);
const explicitQaAction = matches([
  /(?:qa|테스트|시험|회귀|검증).{0,16}(?:진행|실행|돌려|수행|해줘|해주세요)/i,
  /(?:진행|실행|돌려|수행).{0,16}(?:qa|테스트|시험|회귀|검증)/i,
  /\b(?:run|perform|execute)\b.{0,20}\b(?:qa|tests?|validation|verification)\b/i
]);
const asksForQa = rawQa && (!asksForReview || explicitQaAction);

const roles = [];
if (asksForImplementation) roles.push("IMPLEMENTATION");
if (asksForResearch) roles.push("DEEP_RESEARCH");
if (asksForWebResearch) roles.push("WEB_RESEARCH");
if (asksForReview) roles.push("REVIEW");
if (asksForQa) roles.push("QA");

if (!asksForPlan && roles.length === 0) process.exit(0);

const route = asksForPlan && roles.length > 0
  ? "MIXED"
  : roles.length > 0
    ? "SPECIALIST"
    : "PLAN";
const readOnlyRoles = roles.filter((role) => role !== "IMPLEMENTATION");

const lines = [
  "[CGO_ROUTING_V1]",
  "ROUTE=" + route,
  "PLANNER=CURRENT_CLAUDE_MODEL",
  "ROLES=" + (roles.join(",") || "NONE"),
  "MODEL=gpt-5.6-sol",
  "EFFORT_IMPLEMENTATION=xhigh",
  "EFFORT_OTHER_SPECIALISTS=high",
  "READ_ONLY_ROLES=" + (readOnlyRoles.join(",") || "NONE"),
  "THREAD_MODE=fresh",
  "EXECUTION=foreground",
  "ACCOUNTABLE_ORCHESTRATOR=CURRENT_CLAUDE_MODEL",
  "Claude leads. GPT executes. CGO keeps the work observable.",
  "Keep the current native Claude Code /model as the main reasoning, planning, design, orchestration, reconciliation, observability, and user-facing agent. Never create a planner subagent to emulate a model change.",
  roles.length > 0
    ? "For every listed specialist role, call the dispatch MCP tool from server cgo with only {role, brief}. Write a self-contained brief. Do not supply model, effort, write, cwd, resume, or background fields; CGO enforces them. Do not insert a Claude wrapper agent. Deep research, web research, review, and QA are read-only. Implementation is the only write-capable role."
    : "This request is plan/design only. Do not dispatch GPT unless a specialist phase is also requested.",
  "For mixed work, complete the Claude-owned plan/design first, then dispatch specialist roles serially in dependency order.",
  "After every dispatch, call status on server cgo, preserve the job ID and Codex session evidence, and use result for the final receipt. Reconcile the evidence in Claude before answering the user.",
  "Dispatch is fresh foreground only. Automatic resume and background execution are disabled. If the official Codex plugin fails, disclose the failure; do not silently substitute Claude specialist work.",
  "Requested routing is observable, but provider-attested effective model identity remains UNKNOWN_UNTIL_INSTRUMENTED."
];

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: lines.join("\n")
  }
}) + "\n");
