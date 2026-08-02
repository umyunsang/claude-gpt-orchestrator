import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const hookPath = path.resolve("plugins/cgo/hooks/cgo-router.mjs");
const contract = fs.readFileSync("tests/fixtures/router-contract-v2.txt", "utf8")
  .replace(/\r\n?/g, "\n")
  .trimEnd();

function invoke(input) {
  const result = spawnSync(process.execPath, [hookPath], {
    input,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || `hook exited ${result.status}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function route(prompt) {
  return invoke(JSON.stringify({
    session_id: "fixture-session",
    cwd: "/tmp/fixture-project",
    hook_event_name: "UserPromptSubmit",
    prompt
  }));
}

function context(prompt) {
  const output = route(prompt);
  assert.ok(output, `expected routing context for: ${prompt}`);
  assert.equal(output.hookSpecificOutput?.hookEventName, "UserPromptSubmit");
  return output.hookSpecificOutput.additionalContext;
}

test("malformed, empty, and every leading-slash prompt bypass the router", () => {
  assert.equal(invoke("not-json"), null);
  assert.equal(invoke("{}"), null);
  assert.equal(route("  \n\t"), null);
  for (const prompt of [
    "/cgo:doctor",
    "/codex:status",
    "/review",
    "/qa",
    "/agents implement this",
    "   /model opus"
  ]) {
    assert.equal(route(prompt), null, prompt);
  }
});

test("all normal prompts receive one byte-identical language-agnostic contract", () => {
  const prompts = [
    "What does this function do?",
    "Implement the approved login change.",
    "새 로그인 기능을 구현해.",
    "承認されたログイン変更を実装してください。",
    "请审查此更改，但不要修改文件。",
    "ابحث في المصادر الرسمية ولخّص النتائج.",
    "इस बदलाव के लिए रिग्रेशन टेस्ट चलाएँ।",
    "Проведи глубокое исследование по этой теме.",
    "Implementa el cambio de autenticación aprobado.",
    "ኮዱን ይገምግሙ፣ ፋይሎቹን አይቀይሩ።",
    "ตรวจสอบการเปลี่ยนแปลงนี้โดยไม่แก้ไขไฟล์",
    "이 patch를 review만 해. Do not implement."
  ];

  const outputs = prompts.map(context);
  assert.deepEqual([...new Set(outputs)], [contract]);
  for (let index = 0; index < prompts.length; index += 1) {
    assert.doesNotMatch(outputs[index], new RegExp(prompts[index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("the fixed envelope contains the approved semantic and abstention boundary", () => {
  assert.match(contract, /^\[CGO_ROUTING_V2\]/);
  assert.match(contract, /CLASSIFIER_PROVENANCE=CURRENT_CLAUDE_MODEL_SEMANTIC/);
  assert.match(contract, /CONFIDENCE_PROVENANCE=NONE/);
  assert.match(contract, /CLAUDE_ONLY \| SPECIALIST/);
  assert.match(contract, /CLEAR_SINGLE \| CLEAR_MULTI \| AMBIGUOUS \| OOS_UNKNOWN/);
  assert.match(contract, /EXPLICIT \| ABSENT \| CONFLICTING/);
  assert.match(contract, /simple.*CLAUDE_ONLY/i);
  assert.match(contract, /clarif/i);
  assert.match(contract, /false-write/i);
  assert.match(contract, /fresh tracked background/i);
  assert.doesNotMatch(contract, /CGO_ROUTING_V1|ROUTE=|ROLES=/);
  assert.doesNotMatch(contract, /\/Users\//);
});
