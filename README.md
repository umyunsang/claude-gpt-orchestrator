# Claude GPT Orchestrator (CGO)

> Claude leads. GPT executes. CGO keeps the work observable.

CGO is a thin harness for Claude Code. You keep talking to Claude Code normally. A prompt hook detects implementation, build/development, deep research, web research, review, and QA work; Claude then dispatches those bounded specialist phases to GPT-5.6 Sol through OpenAI's official Codex plugin. Claude remains responsible for planning, orchestration, observability, reconciliation, and the final answer.

## Marketplace status

CGO is published as a public **custom Claude Code marketplace**. This GitHub repository is the marketplace source: its root `.claude-plugin/marketplace.json` registers the `cgo` plugin, so users install it directly from `umyunsang/claude-gpt-orchestrator`. Claude Code does not require a separate package-registry upload or marketplace `publish` command for this distribution model.

This does not automatically place CGO in an Anthropic-managed curated catalog. Curated-catalog inclusion would be a separate contribution and review process; it is not required to install or use CGO.

## Quick start: install and apply CGO

### 1. Check the requirements

- Claude Code with plugin marketplace and MCP support
- Node.js 20 or newer
- A working Codex login or account entitlement for GPT-5.6 Sol

The CGO source is free and open source. Claude, Codex, GPT access, subscriptions, API usage, or quota may require paid plans.

### 2. Install the official Codex dependency

Run these commands inside Claude Code:

~~~text
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
~~~

CGO keeps the official Codex plugin as an external dependency; it does not copy or fork OpenAI's plugin code.

### 3. Add the CGO marketplace and install CGO

~~~text
/plugin marketplace add umyunsang/claude-gpt-orchestrator
/plugin install cgo@claude-gpt-orchestrator-marketplace
~~~

Start a new Claude Code session after installation so the CGO prompt hook and MCP server are loaded.

### 4. Verify the installation without calling a model

~~~text
/cgo:doctor
~~~

The doctor checks CGO, the official Codex companion, the fixed model policy, and current-project binding without dispatching a GPT task. Resolve any reported dependency or compatibility error before normal use.

### 5. Use Claude Code normally

No CGO command or manual model switch is required for routine work. Keep the Claude model you want with Claude Code's normal `/model` command, then ask naturally:

- `먼저 인증 흐름을 설계하고 실제 구현까지 진행해.`
- `공식 자료를 웹에서 조사하고 근거와 한계를 정리해.`
- `이 변경사항을 읽기 전용으로 리뷰해.`
- `회귀 테스트와 QA를 실행하고 통과 범위를 보고해.`

CGO applies the responsibility split automatically:

| Your request | What happens |
| --- | --- |
| Planning, architecture, or design only | Stays with the current Claude Code `/model` |
| Implementation or build/development | Claude plans and orchestrates; GPT-5.6 Sol executes with the bounded write policy |
| Deep research, web research, review, or QA | Claude orchestrates; GPT-5.6 Sol executes read-only |
| Mixed request | Claude plans first, then dispatches specialist phases in dependency order and reconciles the receipts |

Optional post-completion observability commands:

~~~text
/cgo:status
/cgo:status task-example-id
/cgo:result task-example-id
~~~

To update an installed copy later, refresh the marketplace and plugin from a terminal, then restart Claude Code:

~~~text
claude plugin marketplace update claude-gpt-orchestrator-marketplace
claude plugin update cgo@claude-gpt-orchestrator-marketplace
~~~

## Why CGO

CGO is built around a cost/performance thesis:

- Spend Claude's main-context reasoning budget where it has the most leverage: understanding the request, architecture, planning, coordination, acceptance, observability, and accountability.
- Move token-heavy specialist execution to GPT-5.6 Sol: code generation, implementation, build work, deep/web research, review, and QA.
- Keep one natural Claude Code conversation instead of asking users to manually switch tools for every phase.
- Preserve a receipt trail so Claude can reconcile what was dispatched, what ran, what changed, and what remains uncertain.

Claude can perform every specialist role itself. CGO intentionally does not make that the default because many users want a better performance-per-token frontier for high-volume execution. Model price, quota, latency, and quality vary by account, date, and workload; CGO does not claim that one model universally wins. Validate the split on your own representative tasks.

## The responsibility split

| Owner | Responsibilities |
| --- | --- |
| Current Claude Code /model | Main reasoning, clarification, architecture, planning, orchestration, reconciliation, observability, final communication, accountability |
| GPT-5.6 Sol via official Codex plugin | Implementation, build/development, deep research, web research, review, QA |
| CGO | Natural-language intent routing, fixed role policy, bounded dispatch, and observable status/result access |

Planning-only requests stay in the current Claude conversation. Mixed requests are planned by Claude first, then dispatched to GPT in dependency order.

## Fixed v0.1.0 policy

| Role | Model | Effort | Mutation |
| --- | --- | --- | --- |
| IMPLEMENTATION | gpt-5.6-sol | xhigh | Current approved project scope only |
| DEEP_RESEARCH | gpt-5.6-sol | high | Read-only |
| WEB_RESEARCH | gpt-5.6-sol | high | Read-only |
| REVIEW | gpt-5.6-sol | high | Read-only |
| QA | gpt-5.6-sol | high | Read-only |

Every dispatch is a fresh foreground task. The public MCP input contains only role and brief. Callers cannot override the model, effort, mutation policy, current project, executable, resume mode, background mode, or credential path.

## How it works

~~~text
normal Claude Code prompt
        |
        v
CGO UserPromptSubmit classifier
        |
        +-- plan/design only ------> current Claude /model
        |
        +-- specialist phase ------> CGO dispatch MCP tool
                                      |
                                      v
                              official codex@openai-codex
                                      |
                                      v
                                  GPT-5.6 Sol
                                      |
                                      v
                         status/result receipt -> Claude
~~~

The classifier is deterministic, but the final decision to invoke the MCP tool is an instruction followed by Claude Code, not a provider-level semantic router. Once dispatch is invoked, CGO enforces the role/model/effort/write/mode contract in code.

## Observability and accountability

CGO reports the requested role, model, effort, mutation policy, project, fresh/foreground mode, and official structured task receipt. It correlates the task's fresh Codex `threadId` with the official structured status snapshot to recover the job ID without scraping model prose. Status and result are also read with the official companion's JSON mode so Claude can reconcile job state, Codex session evidence, touched files, and remaining uncertainty before replying.

This proves requested routing and observable execution. It is not provider-attested effective model identity. Unless an external attestation exists, the effective provider/model identity remains UNKNOWN_UNTIL_INSTRUMENTED.

In v0.1.0, observability is completion-time and post-completion only. Foreground dispatch synchronously occupies the CGO MCP server, so CGO cannot poll or cancel that task while it is running. Receipt state is stored locally through the official companion under CGO's plugin-data directory and remains subject to that companion's retention behavior.

## Security and privacy

- No credentials are bundled or read from CGO arguments.
- The official Codex companion is resolved from Claude Code's installed plugin registry and must realpath inside the openai-codex cache.
- No shell is used for specialist prompts.
- The current Claude project directory is fixed when the MCP server starts; callers cannot choose another cwd.
- Read-only roles cannot request writes.
- Prompts sent to GPT follow the official Codex plugin's data path and your provider/account policies.

See SECURITY.md for the supported-version and vulnerability-reporting policy.

## Current limitations

- Version 0.1.0 supports fresh foreground tasks only.
- Automatic resume and background execution are intentionally disabled.
- In-flight status and cancellation are unavailable; status/result are post-completion surfaces.
- Role routing covers Korean and English phrases but is not a universal natural-language classifier.
- CGO is contract-tested against official codex@openai-codex 1.0.6. The current compatibility check accepts later 1.x versions, but those versions are not individually proven until their contract fixtures pass.
- Cost and quality claims must be validated against your account and workload.

## Project positioning

Repository About:

> Claude-led planning and accountable orchestration with automatic GPT-5.6 dispatch through the official Codex plugin.

The longer public positioning and evidence boundary are recorded in POSITIONING.md.

## License and names

CGO is licensed under Apache-2.0. The official OpenAI plugin is an external dependency and is not vendored.

This independent project is not affiliated with, endorsed by, or sponsored by Anthropic or OpenAI. Claude, Claude Code, Codex, GPT, OpenAI, and Anthropic may be trademarks of their respective owners.
