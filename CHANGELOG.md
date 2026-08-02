# Changelog

All notable changes follow Keep a Changelog principles.

## Unreleased

## 0.2.1 - 2026-08-03

### Fixed

- Stopped applying the POSIX-only `0700` verification on Windows, where Node.js does not implement owner/group/other mode semantics; doctor now reports the Windows ACL as unverified instead of claiming a POSIX boundary.

### Documentation

- Replaced the internal positioning memo and development-oriented README content with production-facing installation and operations documentation.
- Added a production deployment runbook covering preflight, installation, smoke tests, monitoring, updates, rollback, data retention, and troubleshooting.
- Documented that read-only mutation policy is not project-root read isolation and that interactive doctor approval may be required.
- Reworked the README around a scan-first value proposition, immediate quick start, route examples, trust signals, and an evidence-bounded token-economics message.

## 0.2.0 - 2026-08-02

### Added

- One fixed `CGO_ROUTING_V2` envelope for every normal non-slash prompt, with semantic classification owned by the current Claude model.
- Explicit `CLAUDE_ONLY`, specialist, ambiguity, out-of-scope, write-intent, and ordered workflow metadata.
- Exact eight-field MCP validation with stable rejection codes and false-write enforcement before companion discovery.
- Public RouterBench development fixtures for multilingual, code-switch, ambiguity, near-OOS, multi-role, and false-write cases.
- Exact single-job status receipt validation and read-only dead-PID `orphaned` visibility.
- Isolated marketplace and manifest update-flow fixture from 0.1.0 to 0.2.0.

### Changed

- Replaced the Korean/English regular-expression mapper with language-agnostic current-Claude semantic routing.
- Kept simple work in Claude and limited clarification to missing information that changes the role or permission path.
- Enqueued every specialist task through the official tracked background path so long turns do not remain under one outer shell timeout.
- Made the plugin manifest the CGO version authority instead of duplicating the plugin version in the marketplace entry.

### Security

- Enforced a current-user-owned, non-symlink plugin-data root with mode `0700` before companion discovery or execution.
- Documented that the official background path persists the full task prompt and retains up to the latest 50 jobs.
- Sanitized immediate dispatch receipts so they do not echo the raw specialist brief.
- Required exact identities for result receipts and redacted persisted prompt content from result tool responses.

### Limitations

- Deterministic tests prove contract reach and policy enforcement, not live multilingual semantic accuracy.
- Dead-worker observation does not repair the upstream enqueue ordering race.
- Cancellation, automatic resume, and provider-attested effective model identity remain unavailable.

## 0.1.0 - 2026-08-02

### Added

- Natural-language Claude Code routing for implementation, research, review, and QA.
- Fixed GPT-5.6 Sol role, effort, mutation, and current-project contracts.
- Official `codex@openai-codex` dependency resolution with cache realpath checks.
- MCP dispatch, status, result, and no-model doctor tools.
- Apache-2.0 packaging, public documentation, security policy, and CI.
