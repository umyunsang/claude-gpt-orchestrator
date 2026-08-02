<div align="center">

# CGO

**Keep Claude Code's harness. Put every model where it delivers the most value.**

Opus or Fable reasons, designs, plans, and orchestrates. GPT-5.6 Sol handles token-intensive implementation, deep research, web research, review, and QA—with every handoff observable.

[![CI status](https://github.com/umyunsang/claude-gpt-orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/umyunsang/claude-gpt-orchestrator/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/umyunsang/claude-gpt-orchestrator?display_name=tag)](https://github.com/umyunsang/claude-gpt-orchestrator/releases/latest)
[![Apache-2.0 license](https://img.shields.io/github/license/umyunsang/claude-gpt-orchestrator)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/umyunsang/claude-gpt-orchestrator?style=social)](https://github.com/umyunsang/claude-gpt-orchestrator)

[Quick start](#quick-start) · [Why CGO](#why-cgo) · [How it routes](#how-it-routes) · [Production deployment](DEPLOYMENT.md) · [Security](SECURITY.md)

</div>

CGO preserves the native Claude Code harness and keeps your selected Claude `/model` in charge of reasoning, architecture, planning, orchestration, reconciliation, and the final response. Clear, token-intensive execution phases are delegated to GPT-5.6 Sol through the official Codex plugin without leaving the Claude Code conversation.

Keep premium reasoning focused. Scale execution without losing accountability.

No proxy. No second interface. No manual prompt shuttling.

## Quick start

### 1. Install the prerequisites

CGO requires Node.js 20 or newer and a global Python 3 installation. Confirm that both runtimes are available before starting Claude Code:

~~~bash
node --version
python --version
# If your system exposes Python as python3:
python3 --version
~~~

Then start Claude Code in the project where you want to use CGO:

~~~bash
claude
~~~

Run every `/...` command below inside the Claude Code session, not in your system shell.

### 2. Install and set up the official Codex plugin

~~~text
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
~~~

Do not install CGO until `/codex:setup` reports that Codex is ready. If setup reports that Codex is not authenticated, run `!codex login`, complete the sign-in flow, and run `/codex:setup` again.

### 3. Install CGO

~~~text
/plugin marketplace add umyunsang/claude-gpt-orchestrator
/plugin install cgo@claude-gpt-orchestrator-marketplace
/reload-plugins
~~~

### 4. Restart and verify

Restart Claude Code so the new hook and MCP server load. In the new session, run `/plugin` and confirm that both plugins are installed:

- `codex@openai-codex`
- `cgo@claude-gpt-orchestrator-marketplace`

Then run:

~~~text
/cgo:doctor
~~~

Approve the read-only doctor tool if prompted. Doctor verifies CGO, the current project, Node.js, and official Codex plugin compatibility. It does not create a Codex specialist job, although the Claude turn may consume Claude usage.

## Why CGO

| Preserve the harness | Focus Claude on judgment | Scale execution visibly |
| --- | --- | --- |
| Keep Claude Code's native tools, project context, permissions, and workflow. | Let Opus or Fable own high-leverage reasoning, design, planning, sequencing, and reconciliation. | Dispatch token-heavy implementation, research, review, and QA to GPT-5.6 Sol with exact job IDs, bounded permissions, status, results, and receipts. |

The operating idea is simple: use Claude where judgment and system ownership compound; use GPT-5.6 Sol where execution volume grows. CGO is a thin, local policy and observability layer. It does not replace Claude Code, proxy its API, or operate a hosted service.

CGO is designed to improve token economics, not to promise a fixed cost reduction. Actual usage, price, availability, and output quality depend on the selected models, accounts, prompts, and workloads.

> If CGO makes your Claude Code workflow more useful, please **star the repository**. It helps other developers discover the project.

## How it routes

Use Claude Code normally. Automatic routing applies to ordinary non-slash prompts; no CGO command or manual model switch is required.

| Request | Default behavior |
| --- | --- |
| `Explain this function in plain language.` | Claude answers directly. |
| `Design the authentication flow, then implement it.` | Claude designs and orchestrates; GPT handles the explicit implementation phase. |
| `Search the official documentation, then synthesize the evidence.` | GPT performs bounded web research; Claude reconciles and presents the answer. |
| `Review this patch without modifying files.` | GPT performs a read-only review; Claude owns the final response. |
| `Run regression QA and report exactly what passed.` | GPT runs a read-only QA phase with an observable job receipt. |

Simple explanation, translation, formatting, planning, design, and small routine work stay in Claude. Clear specialist phases dispatch automatically. If missing information changes the specialist role or permission path, Claude should clarify once before dispatch. Ambiguous, conflicting, or unsupported requests do not launch a specialist.

CGO uses current-Claude semantic classification with no language allow-list or translation dictionary. Prompts can be written in any language supported by the active Claude model, but this does not guarantee identical accuracy across languages, models, or workloads.

Prompts beginning with `/` bypass automatic routing so native Claude Code and plugin commands retain their normal behavior.

## Requirements

- Claude Code with plugin marketplace and MCP support
- Node.js 20 or newer
- Python 3 installed globally and available as `python` or `python3`
- Official `codex@openai-codex` plugin version 1.0.6 or a compatible later 1.x release
- A successful `/codex:setup` result before CGO is installed or used
- Working Claude and Codex account configurations

CGO is free and open source. Claude, Codex, GPT access, subscriptions, API usage, or quota may require a paid plan or subscription.

## Roles and permissions

| Role | Requested model | Effort | Mutation policy |
| --- | --- | --- | --- |
| `IMPLEMENTATION` | `gpt-5.6-sol` | `xhigh` | Current project, only when the user explicitly requests changes |
| `DEEP_RESEARCH` | `gpt-5.6-sol` | `high` | Read-only |
| `WEB_RESEARCH` | `gpt-5.6-sol` | `high` | Read-only |
| `REVIEW` | `gpt-5.6-sol` | `high` | Read-only |
| `QA` | `gpt-5.6-sol` | `high` | Read-only |

Only `IMPLEMENTATION` with explicit write intent can receive workspace-write permission. Research, review, and QA remain read-only. Conflicting write instructions are rejected before a Codex job is created.

CGO fixes the requested model, effort, project directory, fresh-thread mode, background execution, and mutation policy. These values cannot be replaced with user-supplied MCP overrides.

## Observe specialist jobs

CGO uses tracked background jobs so long specialist work is not held inside one foreground shell call.

~~~text
/cgo:status
/cgo:status task-example-id
/cgo:result task-example-id
~~~

Use the complete job ID returned by dispatch. Result retrieval verifies that the returned job identities exactly match the requested ID. The prompt stored in the local job record is redacted from the result tool response.

## Production operation

See [DEPLOYMENT.md](DEPLOYMENT.md) for pre-deployment checks, smoke tests, updates, rollback, incident handling, and a production deployment record.

To update both plugins:

~~~text
claude plugin marketplace update openai-codex
claude plugin update codex@openai-codex

claude plugin marketplace update claude-gpt-orchestrator-marketplace
claude plugin update cgo@claude-gpt-orchestrator-marketplace
~~~

Restart Claude Code and run `/cgo:doctor` after updating.

## Local data and security

CGO uses Claude Code's dedicated plugin-data directory and rejects symbolic-link or non-directory roots on every platform. On POSIX systems it also enforces current-user ownership and mode `0700`. On Windows, where Node.js cannot represent owner/group/other permissions with POSIX mode bits, CGO leaves the existing Windows ACL unchanged instead of applying a false `0700` check. Doctor reports `WINDOWS_ACL_UNVERIFIED` because CGO does not audit the DACL. Keep Windows plugin data under the default user-profile location; do not point it at a shared or network directory.

Tracked background execution requires the official Codex companion to persist the full specialist prompt and job request locally. Official companion 1.0.6 retains up to the latest 50 jobs and prunes older job files and logs as new state is saved. CGO does not expose a secure purge command. Treat the plugin-data directory as sensitive and include it in local device and backup policies.

Read-only prevents CGO from granting workspace-write permission; it is not project-root read isolation. Claude Code, Codex, project instructions, global instructions, and installed tooling may read files outside the current project. Run CGO only under a trusted local account and review instruction files before handling sensitive repositories.

CGO does not bundle or manage credentials. The official Codex companion must resolve from the installed `openai-codex` marketplace cache. See [SECURITY.md](SECURITY.md) for the complete security and retention boundary.

## Compatibility and limitations

- CGO records the requested `gpt-5.6-sol` route, but the current official receipt does not attest the effective provider-side model identity. It remains `UNKNOWN_UNTIL_INSTRUMENTED`.
- Cancellation, automatic resume, automatic orphan repair, and server-enforced cross-call workflow ordering are not available in 0.2.1.
- A queued or running job whose process no longer exists may be reported as `orphaned`; CGO does not restart or rewrite that job.
- CGO is compatible with official Codex plugin 1.x releases from 1.0.6, subject to contract verification by `/cgo:doctor`.
- This repository is a public custom Claude Code marketplace. It is not an Anthropic-managed curated marketplace.

## Uninstall

Preserve retained job data while removing CGO:

~~~text
claude plugin uninstall cgo@claude-gpt-orchestrator-marketplace --scope user --keep-data
claude plugin marketplace remove claude-gpt-orchestrator-marketplace --scope user
~~~

The official Codex plugin remains installed and can continue to be used independently.

## Support and contributing

- Read the [production runbook](DEPLOYMENT.md) for setup and operational issues.
- Read the [security policy](SECURITY.md) before reporting sensitive findings.
- Open a GitHub issue for reproducible non-sensitive bugs or feature requests.
- See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## License and trademarks

CGO is licensed under [Apache-2.0](LICENSE). The official OpenAI Codex plugin is an external dependency and is not vendored.

This independent project is not affiliated with, endorsed by, or sponsored by Anthropic or OpenAI. Claude, Claude Code, Codex, GPT, OpenAI, and Anthropic may be trademarks of their respective owners.
