import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const skill = fs.readFileSync("plugins/cgo/skills/cgo/SKILL.md", "utf8");

test("the CGO skill implements the v2 semantic, abstention, and simple-task contract", () => {
  assert.match(skill, /CGO_ROUTING_V2/);
  assert.match(skill, /CLAUDE_ONLY.*SPECIALIST/s);
  assert.match(skill, /CLEAR_SINGLE.*CLEAR_MULTI.*AMBIGUOUS.*OOS_UNKNOWN/s);
  assert.match(skill, /EXPLICIT.*ABSENT.*CONFLICTING/s);
  assert.match(skill, /simple.*stay.*Claude/i);
  assert.match(skill, /clarif.*once/i);
  assert.match(skill, /missing information changes.*role or permission path/i);
  assert.match(skill, /OOS_UNKNOWN.*do not dispatch/is);
  assert.match(skill, /numeric confidence.*never.*dispatch/is);
});

test("the skill supplies the exact eight-field dispatch boundary", () => {
  for (const field of [
    "role",
    "brief",
    "router_contract",
    "decision_state",
    "write_intent",
    "workflow_id",
    "sequence_index",
    "sequence_total"
  ]) {
    assert.match(skill, new RegExp(`\\b${field}\\b`));
  }
  assert.match(skill, /CLEAR_SINGLE.*workflow_id.*null.*1\/1/is);
  assert.match(skill, /CLEAR_MULTI.*2\.\.5/is);
  assert.match(skill, /Review, then fix confirmed findings.*REVIEW\/ABSENT.*IMPLEMENTATION\/EXPLICIT/is);
  assert.match(skill, /fresh tracked background/i);
  assert.match(skill, /UNKNOWN_UNTIL_INSTRUMENTED/);
  assert.doesNotMatch(skill, /input is intentionally only \{ role, brief \}/i);
});
