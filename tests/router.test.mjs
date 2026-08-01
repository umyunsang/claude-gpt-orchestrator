import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const hookPath = path.resolve(
  "plugins/cgo/hooks/cgo-router.mjs"
);

function route(prompt) {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({
      session_id: "fixture-session",
      cwd: "/tmp/fixture-project",
      hook_event_name: "UserPromptSubmit",
      prompt
    }),
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || `hook exited ${result.status}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function context(prompt) {
  const output = route(prompt);
  assert.ok(output, `expected routing context for: ${prompt}`);
  return output.hookSpecificOutput.additionalContext;
}

test("routes specialist and mixed work while retaining the current Claude planner", () => {
  assert.match(context("새 로그인 기능을 구현해"), /ROLES=IMPLEMENTATION/);
  assert.match(context("공식 자료로 딥리서치해"), /ROLES=DEEP_RESEARCH/);
  assert.match(context("웹에서 최신 자료를 검색해 조사해"), /ROLES=WEB_RESEARCH/);
  assert.match(context("이 변경사항을 코드 리뷰해"), /ROLES=REVIEW/);
  assert.match(context("회귀 테스트와 QA를 진행해"), /ROLES=QA/);

  const mixed = context("먼저 설계하고 이어서 기능을 구현해");
  assert.match(mixed, /ROUTE=MIXED/);
  assert.match(mixed, /PLANNER=CURRENT_CLAUDE_MODEL/);
  assert.match(mixed, /dispatch/);
});

test("read-only language suppresses incidental implementation words", () => {
  const review = context("READ-ONLY REVIEW. Do not implement the fix.");
  assert.match(review, /ROLES=REVIEW/);
  assert.doesNotMatch(review, /ROLES=.*IMPLEMENTATION/);

  const staged = context("먼저 읽기 전용 리뷰하고 그 다음 발견된 문제를 실제로 수정해");
  assert.match(staged, /ROLES=.*IMPLEMENTATION/);
  assert.match(staged, /ROLES=.*REVIEW/);
});

test("review and QA targets do not escalate incidental implementation nouns to write access", () => {
  for (const prompt of [
    "이 구현을 코드 리뷰해",
    "구현된 로그인 기능의 회귀 테스트와 QA를 진행해",
    "Review this implementation",
    "Run QA for this implementation",
    "Review this fix"
  ]) {
    const routed = context(prompt);
    assert.doesNotMatch(routed, /ROLES=.*IMPLEMENTATION/, prompt);
  }

  assert.match(context("이 구현을 코드 리뷰해"), /ROLES=REVIEW/);
  assert.match(
    context("구현된 로그인 기능의 회귀 테스트와 QA를 진행해"),
    /ROLES=QA/
  );

  const staged = context("먼저 구현을 리뷰하고 발견된 문제를 실제로 수정해");
  assert.match(staged, /ROLES=.*IMPLEMENTATION/);
  assert.match(staged, /ROLES=.*REVIEW/);
});

test("does not route unrelated prompts or direct Codex commands", () => {
  assert.equal(route("오늘 날짜가 뭐야?"), null);
  assert.equal(route("/codex:status"), null);
});

test("generated context is portable and contains no user home path", () => {
  const output = context("QA 검증을 실행해");
  assert.doesNotMatch(output, /\/Users\//);
  assert.match(output, /server .*cgo/i);
  assert.match(output, /fresh foreground/i);
});
