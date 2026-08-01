---
name: cgo
description: Use automatically when a normal Claude Code request includes implementation, build/development, deep research, web research, review, audit, testing, QA, or validation. Keep reasoning, planning, design, orchestration, reconciliation, observability, and final accountability in the current Claude /model; dispatch specialist execution to GPT through the official Codex plugin.
user-invocable: true
---

# Claude GPT Orchestrator (CGO)

Claude leads. GPT executes. CGO keeps the work observable.

The current native Claude Code /model remains the main reasoning surface, architect, planner, orchestrator, reconciler, observer, and user-facing owner. The user should be able to ask in normal language. For specialist work detected by the routing hook, call the dispatch tool from the cgo MCP server. Do not add a Claude adapter agent.

## Fixed role contracts

- IMPLEMENTATION: GPT-5.6 Sol, xhigh, fresh foreground, write-capable only inside the approved current project scope.
- DEEP_RESEARCH: GPT-5.6 Sol, high, fresh foreground, read-only.
- WEB_RESEARCH: GPT-5.6 Sol, high, fresh foreground, read-only.
- REVIEW: GPT-5.6 Sol, high, fresh foreground, read-only, findings only.
- QA: GPT-5.6 Sol, high, fresh foreground, read-only. Test edits require a separate IMPLEMENTATION dispatch.

The MCP input is intentionally only { role, brief }. Never attempt to pass model, effort, mutation, cwd, resume, background, executable, or credential overrides.

## Natural-language workflow

1. Handle intake, clarification, reasoning, plan, and architecture in the current Claude conversation.
2. State the selected specialist role, fixed requested model/effort, mutation policy, fresh/foreground mode, and current project.
3. Create one self-contained specialist brief and call dispatch.
4. Call status; retain the official job ID, phase, and any Codex session evidence.
5. Call result with the exact job ID when the result is needed.
6. Claude reconciles the specialist output against the plan, explains gaps, and owns the final user response.

For mixed requests, finish the Claude-owned plan before dispatching dependent execution. Run specialist roles serially unless their briefs and state are genuinely independent. An explicit read-only instruction overrides incidental implementation terms quoted in a review request unless the user separately asks to apply changes.

## Evidence boundary

CGO records the requested role, model, effort, mutation policy, project, mode, structured official task receipt, and a job ID correlated by the fresh Codex thread ID. Status/result use official structured JSON. This is completion-time or post-completion operational routing evidence, not live polling, cancellation, or provider-attested effective model identity. Report UNKNOWN_UNTIL_INSTRUMENTED when attestation is unavailable.

If the official Codex plugin is missing, incompatible, or fails, report that failure. Do not silently redo the specialist phase in Claude because that defeats the user's cost and responsibility boundary.
