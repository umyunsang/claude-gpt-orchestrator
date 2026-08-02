# CGO production deployment

This runbook installs and operates Claude GPT Orchestrator (CGO) as a user-scope Claude Code plugin on a trusted workstation. CGO is not a hosted service or a system daemon. Deploy it separately for each operating-system account that uses Claude Code.

## Deployment model

| Component | Production responsibility |
| --- | --- |
| Claude Code | Main conversation, selected `/model`, semantic routing decision, orchestration, and final response |
| CGO | Routing contract, permission enforcement, background dispatch, status, and result correlation |
| Official `codex@openai-codex` plugin | Codex job execution and retained local job state |
| Local operator | Claude and Codex authentication, project trust, instruction files, upgrades, backups, and incident handling |

## Pre-deployment checklist

Confirm the following before installation:

- The workstation and user account are trusted.
- Claude Code is installed and can start an interactive session.
- Node.js 20 or newer is available.
- Python 3 is installed globally and available as `python` or `python3`.
- Codex authentication is already configured by the operator.
- The operator understands that CGO stores full specialist prompts locally for tracked background jobs.
- The operator understands that read-only is not project-root read isolation. Global or project instructions and tools may read outside the current project.
- Existing Claude Code sessions can be restarted after installation.

Record the current versions and plugin state for rollback evidence:

~~~text
claude --version
node --version
python --version
claude plugin marketplace list
claude plugin list --json
~~~

If the workstation exposes Python only as `python3`, record `python3 --version` instead.

Do not copy credentials into deployment notes or support tickets.

## Install at user scope

Start Claude Code in a trusted project:

~~~bash
claude
~~~

Run all remaining installation commands in that Claude Code session. Install and initialize the official dependency first:

~~~text
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
~~~

Do not continue until `/codex:setup` reports that Codex is ready. If authentication is required, run `!codex login`, complete sign-in, and run `/codex:setup` again.

Install CGO from the public custom marketplace only after Codex setup succeeds:

~~~text
/plugin marketplace add umyunsang/claude-gpt-orchestrator
/plugin install cgo@claude-gpt-orchestrator-marketplace
/reload-plugins
~~~

The expected plugin IDs are:

- `codex@openai-codex`
- `cgo@claude-gpt-orchestrator-marketplace`

Restart Claude Code after installation. An already-running session may not load the newly installed hook, commands, or MCP server.

## Post-deployment verification

### 1. Verify installation state

~~~text
claude plugin marketplace list
claude plugin list --json
~~~

Confirm that both expected plugin IDs are enabled at user scope and that CGO reports version `0.2.1`.

### 2. Run doctor

Start a new interactive Claude Code session in a trusted project and run:

~~~text
/cgo:doctor
~~~

Approve the read-only doctor MCP tool if prompted. A healthy result reports:

- CGO version `0.2.1`;
- the current project directory;
- the resolved plugin-data directory;
- requested model `gpt-5.6-sol`;
- official Codex plugin version 1.0.6 or a compatible later 1.x release;
- `compatible: true`;
- no Codex specialist model call performed by doctor.

The Claude turn used to invoke doctor can consume Claude usage even though doctor does not create a Codex specialist job.

### 3. Verify the Claude-only route

Submit a simple request such as:

~~~text
Translate the word hello into French. Answer with only the translation.
~~~

The request should be answered directly by Claude without a new CGO specialist job.

### 4. Verify a read-only specialist route

Use a non-sensitive fixture in a disposable project:

~~~text
Review this file without modifying anything. Report findings only and include the CGO job ID and terminal status.
~~~

Expected behavior:

- Claude selects `REVIEW`;
- CGO records `write: false` and `resumeLast: false`;
- dispatch returns one exact job ID;
- status progresses from queued or running to a terminal state;
- result retrieval uses that complete job ID;
- the fixture remains byte-identical.

Independently compare file hashes before and after the smoke test. A receipt field such as `touchedFiles: []` is useful evidence but is not a substitute for a filesystem comparison in high-assurance environments.

## Runtime operation

### Normal use

Operators submit normal natural-language requests. CGO is automatic for non-slash prompts. Slash commands bypass the routing hook.

Simple work stays in Claude. Clear implementation, deep research, web research, review, and QA phases may dispatch. If missing information changes the role or mutation path, Claude should clarify once before dispatch.

### Observe jobs

~~~text
/cgo:status
/cgo:status task-full-job-id
/cgo:result task-full-job-id
~~~

Always retain the complete job ID returned by dispatch. Do not use an abbreviated prefix for exact status or result retrieval.

The result response redacts the persisted specialist prompt. The original prompt remains in the official local job state until pruned by the companion's retention behavior.

### Permission policy

- `IMPLEMENTATION` requires explicit requested changes and can receive workspace-write permission.
- `DEEP_RESEARCH`, `WEB_RESEARCH`, `REVIEW`, and `QA` are read-only.
- Conflicting or incomplete write intent rejects before job creation.
- Callers cannot override the model, effort, project directory, executable, provider, credential path, thread mode, background mode, or timeout through CGO tool arguments.

Read-only is not read isolation. It prevents CGO from granting writes, but it does not guarantee that Claude Code, Codex, instruction discovery, or installed tooling will restrict reads to the project directory.

## Local data and retention

Claude Code supplies a dedicated plugin-data path. The resolved path is authoritative in `/cgo:doctor`; a typical user installation uses:

~~~text
~/.claude/plugins/data/cgo-claude-gpt-orchestrator-marketplace
~~~

CGO rejects symbolic-link or non-directory roots on every platform. On POSIX systems it verifies current-user ownership and enforces mode `0700`; files below the root may use the official companion's default modes, while the non-traversable root provides the local-account boundary. On Windows it leaves the existing ACL unchanged and reports `WINDOWS_ACL_UNVERIFIED`, because POSIX owner/group/other mode bits are not available there and CGO does not audit or rewrite DACL entries. Keep the default user-profile location and do not configure a shared or network directory for sensitive jobs.

Official companion 1.0.6 retains up to the latest 50 jobs, including the full specialist prompt, request metadata, results, and logs. CGO does not provide retention-period configuration or a secure purge command. Apply device encryption, account access control, backup policy, and endpoint monitoring appropriate for the repository sensitivity.

The requested model and policy are observable. Provider-attested effective model identity is not currently present in the official receipt and must be reported as `UNKNOWN_UNTIL_INSTRUMENTED`.

## Update

Record the current plugin list, then update the official dependency and CGO:

~~~text
claude plugin marketplace update openai-codex
claude plugin update codex@openai-codex

claude plugin marketplace update claude-gpt-orchestrator-marketplace
claude plugin update cgo@claude-gpt-orchestrator-marketplace
~~~

Restart Claude Code and repeat the post-deployment verification. Do not treat a successful download as proof that an existing session loaded the new version.

## Rollback and removal

To disable CGO while preserving retained job data:

~~~text
claude plugin uninstall cgo@claude-gpt-orchestrator-marketplace --scope user --keep-data
claude plugin marketplace remove claude-gpt-orchestrator-marketplace --scope user
~~~

Restart Claude Code and confirm that CGO is absent from `claude plugin list --json`.

The official Codex plugin is independent and remains installed. Remove it only if the operator separately decides that Codex should no longer be available.

Omitting `--keep-data` may remove CGO's persistent data. Inspect and back up required receipts before any destructive cleanup. Restoring an old settings file is not a safe default rollback because it can overwrite unrelated changes made after deployment.

## Troubleshooting

### CGO does not appear in a session

- Confirm `cgo@claude-gpt-orchestrator-marketplace` is enabled in `claude plugin list --json`.
- Restart Claude Code.
- Confirm the custom marketplace is listed.
- Re-run installation if the plugin cache is incomplete.

### Doctor is denied

Run `/cgo:doctor` in an interactive session and approve the read-only MCP tool. Non-interactive `dontAsk` mode rejects a tool unless it is explicitly allowlisted for that process.

### Official Codex plugin is missing or incompatible

Update `openai-codex`, update `codex@openai-codex`, restart Claude Code, and run doctor again. CGO 0.2.1 accepts compatible official 1.x releases from 1.0.6.

### A job remains queued or running

Use the exact job ID with `/cgo:status`. CGO may report a missing worker process as `orphaned`, but version 0.2.1 does not cancel, restart, repair, or automatically resume that job.

### Result retrieval fails

Use the complete job ID returned by dispatch. CGO rejects prefixes, unsafe identifiers, and receipts whose returned identities do not exactly match the requested job.

## Deployment record

For each managed workstation, record only non-secret operational evidence:

- deployment date;
- Claude Code version;
- Node.js version;
- CGO version;
- official Codex plugin version;
- marketplace and plugin enablement result;
- doctor compatibility result;
- smoke-test job ID and terminal status;
- independent fixture hash comparison;
- known gaps and rollback owner.

Never record credentials or private specialist prompts in the deployment record.
