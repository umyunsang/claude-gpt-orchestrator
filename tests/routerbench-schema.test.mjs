import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const fixturePath = "tests/fixtures/routerbench-dev-v2.jsonl";
const roles = new Set(["IMPLEMENTATION", "DEEP_RESEARCH", "WEB_RESEARCH", "REVIEW", "QA"]);
const routeNeeds = new Set(["CLAUDE_ONLY", "SPECIALIST"]);
const decisionStates = new Set(["CLEAR_SINGLE", "CLEAR_MULTI", "AMBIGUOUS", "OOS_UNKNOWN"]);
const writeIntents = new Set(["EXPLICIT", "ABSENT", "CONFLICTING"]);

function records() {
  return fs.readFileSync(fixturePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL record ${index + 1}: ${error.message}`);
      }
    });
}

test("RouterBench dev records have valid routing, sequence, and write contracts", () => {
  const data = records();
  assert.ok(data.length >= 30);
  const ids = new Set();
  for (const record of data) {
    assert.match(record.id, /^RB-[A-Z]{2}-\d{3}$/);
    assert.equal(ids.has(record.id), false, `duplicate ${record.id}`);
    ids.add(record.id);
    assert.equal(typeof record.prompt, "string");
    assert.ok(record.prompt.trim());
    assert.equal(typeof record.language, "string");
    assert.equal(typeof record.script, "string");
    assert.ok(["native-authored", "code-switched", "curated"].includes(record.provenance));
    assert.ok(Array.isArray(record.phenomena) && record.phenomena.length > 0);

    const gold = record.gold;
    assert.ok(routeNeeds.has(gold.route_need), record.id);
    assert.ok(decisionStates.has(gold.decision_state), record.id);
    assert.ok(writeIntents.has(gold.write_intent), record.id);
    assert.ok(Array.isArray(gold.candidate_roles), record.id);
    assert.ok(Array.isArray(gold.sequence), record.id);
    assert.ok(gold.candidate_roles.every((role) => roles.has(role)), record.id);
    assert.ok(gold.sequence.every((step) => roles.has(step.role) && writeIntents.has(step.write_intent)), record.id);

    if (gold.route_need === "CLAUDE_ONLY") {
      assert.deepEqual(gold.candidate_roles, [], record.id);
      assert.deepEqual(gold.sequence, [], record.id);
    }
    if (["AMBIGUOUS", "OOS_UNKNOWN"].includes(gold.decision_state)) {
      assert.deepEqual(gold.sequence, [], record.id);
    }
    if (gold.decision_state === "CLEAR_SINGLE" && gold.route_need === "SPECIALIST") {
      assert.equal(gold.sequence.length, 1, record.id);
    }
    if (gold.decision_state === "CLEAR_MULTI") {
      assert.ok(gold.sequence.length >= 2 && gold.sequence.length <= 5, record.id);
    }
    for (const step of gold.sequence) {
      if (step.role === "IMPLEMENTATION") assert.equal(step.write_intent, "EXPLICIT", record.id);
      else assert.equal(step.write_intent, "ABSENT", record.id);
    }
  }
});

test("RouterBench dev covers the required multilingual and safety slices", () => {
  const data = records();
  const languages = new Set(data.map((record) => record.language));
  for (const language of ["en", "ko", "ja", "zh", "ar", "hi", "ru", "es", "am", "th"]) {
    assert.ok(languages.has(language), `missing ${language}`);
  }
  const phenomena = new Set(data.flatMap((record) => record.phenomena));
  for (const required of [
    "false-write-hard-negative",
    "quoted-action",
    "simple-claude-only",
    "near-oos",
    "ambiguity",
    "clear-multi",
    "code-switch"
  ]) {
    assert.ok(phenomena.has(required), `missing ${required}`);
  }
  assert.ok(data.filter((record) => record.provenance === "code-switched").length >= 2);
  assert.ok(data.some((record) => record.gold.decision_state === "OOS_UNKNOWN"));
  assert.ok(data.some((record) => record.gold.write_intent === "CONFLICTING"));
});
