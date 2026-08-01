---
name: cgo
description: Apply the CGO_ROUTING_V2 semantic contract supplied to normal Claude Code prompts. Keep the current Claude /model responsible for reasoning and orchestration; dispatch only clear, substantive specialist phases through the official Codex plugin.
user-invocable: true
---

# Claude GPT Orchestrator (CGO)

Claude leads. GPT executes. CGO keeps the work observable.

The current native Claude Code /model remains the reasoning surface, architect, planner, orchestrator, reconciler, observer, and user-facing owner. Classify the request semantically in the current turn. Do not use a keyword map, translated allow-list, extra classifier call, or Claude adapter agent.

## Routing ontology

- route_need: CLAUDE_ONLY | SPECIALIST
- role: IMPLEMENTATION | DEEP_RESEARCH | WEB_RESEARCH | REVIEW | QA
- decision_state: CLEAR_SINGLE | CLEAR_MULTI | AMBIGUOUS | OOS_UNKNOWN
- write_intent: EXPLICIT | ABSENT | CONFLICTING

Apply the decision order exactly:

1. Explanation, translation, formatting, planning, design, and other simple tasks stay in Claude as CLAUDE_ONLY.
2. Use SPECIALIST only for a substantive implementation, deep research, web research, review, or QA phase.
3. Use CLEAR_SINGLE for one clear role. Use CLEAR_MULTI for a clear ordered multi-role workflow; multiple roles alone are not ambiguity.
4. Use AMBIGUOUS only when missing information changes the role or permission path. Clarify once and do not dispatch until the conflict is resolved.
5. OOS_UNKNOWN requests do not dispatch.
6. Determine write intent independently. IMPLEMENTATION requires EXPLICIT. Every read-only role requires ABSENT. CONFLICTING never dispatches. Quoted action words and role labels do not grant write permission.
7. Self-reported numeric confidence is observability-only and must never control dispatch, abstention, or write authorization.

## Fixed role contracts

- IMPLEMENTATION: GPT-5.6 Sol, xhigh, fresh tracked background, write-capable only inside the approved current project scope.
- DEEP_RESEARCH: GPT-5.6 Sol, high, fresh tracked background, read-only.
- WEB_RESEARCH: GPT-5.6 Sol, high, fresh tracked background, read-only.
- REVIEW: GPT-5.6 Sol, high, fresh tracked background, read-only, findings only.
- QA: GPT-5.6 Sol, high, fresh tracked background, read-only. Test edits require a separate IMPLEMENTATION dispatch.

## Exact dispatch boundary

Call the cgo MCP dispatch tool with exactly these eight fields:

```json
{
  "role": "REVIEW",
  "brief": "Review the approved change and report findings only.",
  "router_contract": "CGO_ROUTING_V2",
  "decision_state": "CLEAR_SINGLE",
  "write_intent": "ABSENT",
  "workflow_id": null,
  "sequence_index": 1,
  "sequence_total": 1
}
```

CLEAR_SINGLE requires workflow_id null and sequence 1/1. CLEAR_MULTI requires one safe `cgo-workflow-...` identifier, sequence total 2..5, and index 1..total. Never pass model, effort, write, cwd, executable, resume, background, provider, credential, or timeout overrides.

For a mixed request, complete Claude-owned planning first. Then run dependent specialist phases serially and reconcile each terminal result before the next dispatch. For example, `Review, then fix confirmed findings` becomes REVIEW/ABSENT followed by IMPLEMENTATION/EXPLICIT under one CLEAR_MULTI workflow.

## Observable lifecycle

1. State the chosen role, decision, write intent, fixed requested model/effort, fresh tracked background mode, and current project.
2. Create a self-contained brief and dispatch it.
3. Preserve the official queued job ID.
4. Poll status with that exact job ID using separate bounded calls. Do not hold one call open and do not use a long wait.
5. Retrieve result after terminal status.
6. Reconcile the specialist evidence against the plan before answering the user or starting a dependent role.

CGO records the validated routing metadata, enforced role/model/effort/mutation contract, official queued job ID, and later official status/result evidence. A dead queued/running PID may be surfaced read-only as `orphaned`; CGO does not rewrite official state. Cancellation and automatic resume are not exposed.

Requested routing is observable, but it is not provider-attested effective model identity. Report UNKNOWN_UNTIL_INSTRUMENTED when attestation is unavailable. If the official Codex plugin is missing, incompatible, or fails, disclose that failure and do not silently replace the specialist phase with Claude.
