# Security policy

## Supported versions

Only the latest 0.2.x release is supported during preview.

## Reporting

Use GitHub private vulnerability reporting. Do not open a public issue for credential exposure, path-boundary bypasses, command execution, local prompt disclosure, or permission-policy bypasses. Keep a minimal reproduction locally and do not include credentials or private prompts.

## Threat boundary

CGO treats natural-language prompts, MCP arguments, plugin registry entries, filesystem paths, job IDs, companion output, and stored job state as untrusted.

Security invariants:

- only the official `codex@openai-codex` registry entry is accepted;
- the companion realpath must remain inside the official marketplace cache;
- dispatch requires the exact eight-field `CGO_ROUTING_V2` metadata contract;
- ambiguous, out-of-scope, conflicting, incomplete, and unexpected metadata rejects before companion discovery or execution;
- model, effort, mutation, cwd, executable, resume, background, provider, credential, and timeout settings are fixed;
- no shell interprets the specialist brief;
- only `IMPLEMENTATION + EXPLICIT` is write-capable;
- status/result job identifiers and workflow identifiers are allowlisted;
- exact-job and all-job official JSON receipts are validated independently;
- result receipts require the returned job and stored-job identities to equal the requested full job ID;
- persisted `storedJob.request.prompt` content is redacted from CGO result tool responses;
- doctor performs no model call.

Read-only roles prevent CGO from granting workspace-write permission. They do not provide project-root read isolation. Claude Code, Codex, global and project instructions, and installed tooling may read outside the current project. Use CGO only from a trusted local account and review instruction files before operating on sensitive repositories.

## Local prompt persistence and retention

The official background worker stores the full specialist prompt as part of its local task request. The request can appear in both the per-job JSON file and retained state so the detached worker and later result flow can continue after dispatch returns. CGO removes that prompt field from result tool responses; this output redaction does not erase the official local record.

Before companion discovery or execution, CGO creates or resolves its dedicated plugin-data root and rejects symbolic-link or non-directory roots on every platform. On POSIX systems it rejects a directory owned by another user and enforces mode `0700`; files below it may use the official companion's default modes, while the non-traversable root is the local-account isolation boundary. Windows does not expose equivalent owner/group/other semantics through Node.js mode bits, so CGO leaves the existing Windows ACL unchanged and reports `WINDOWS_ACL_UNVERIFIED` instead of asserting `0700`. CGO does not audit or rewrite Windows DACL entries. Keep the default user-profile location and do not configure a shared or network directory for sensitive jobs.

Official companion 1.0.6 retains at most the latest 50 jobs. As new state is saved, it prunes older job files and associated logs. CGO does not expose deletion, retention-period configuration, or a secure purge command. Users should treat this directory as sensitive and apply their own device, backup, and account-access policies.

CGO may annotate a queued/running job whose PID is no longer present as `orphaned`. This is a read-only observation and does not rewrite, restart, cancel, or delete official state.

## Credentials and provider boundary

CGO does not manage Claude, Codex, OpenAI, or Anthropic credentials and does not accept credential paths through its MCP tools. Prompts and outputs remain subject to the official Codex plugin and provider/account policies.

Requested model routing is observable, but the current receipt is not provider-attested effective identity. CGO reports `UNKNOWN_UNTIL_INSTRUMENTED` where attestation is unavailable.
