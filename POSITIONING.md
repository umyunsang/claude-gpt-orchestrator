# CGO positioning

## Product thesis

Claude GPT Orchestrator uses each model where this workflow expects the highest leverage per token.

Claude owns the main conversation: reasoning, architecture, planning, orchestration, reconciliation, observability, user communication, and accountability. GPT-5.6 Sol performs bounded, token-heavy specialist execution through the official Codex plugin: implementation, build/development, deep and web research, review, and QA.

The user does not manually shuttle prompts between products. They speak to Claude Code normally; CGO detects specialist phases, Claude creates the contract, CGO enforces the dispatch policy, and Claude reconciles the evidence.

## Short lockup

> Claude leads. GPT executes. CGO keeps the work observable.

## Repository About

> Claude-led planning and accountable orchestration with automatic GPT-5.6 dispatch through the official Codex plugin.

## README lead

> Keep Claude on the high-leverage decisions. Dispatch token-heavy specialist work to GPT-5.6. Keep one Claude Code conversation and one accountable orchestration trail.

## Claim boundary

CGO is motivated by the user's observed cost/quality tradeoff: using premium Claude capacity for every implementation, research, review, and QA token can be more expensive without a proportional quality gain over GPT-5.6 on those workloads.

That is the product thesis, not a universal benchmark result. Public claims must distinguish:

- package facts: exact role policies, fixed model requests, permissions, automatic hook behavior, and receipts;
- locally observed evidence: named versions, fixtures, canaries, and review results;
- changing external facts: plan prices, quotas, model availability, and provider behavior;
- workload hypotheses: relative quality and performance per token.

Do not publish universal claims such as “GPT is always better” or fixed savings percentages without a dated, reproducible benchmark and matched account costs.
