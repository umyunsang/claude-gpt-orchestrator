# Claude GPT Orchestrator (CGO)

> Claude leads. GPT executes. CGO keeps the work observable.

CGO is a thin harness for Claude Code. Keep the Claude model you want through the normal `/model` command. The current Claude conversation owns reasoning, architecture, planning, orchestration, reconciliation, observability, accountability, and the final answer. Clear, substantive implementation, deep research, web research, review, and QA phases can be dispatched to GPT-5.6 Sol through OpenAI's official Codex plugin.

Version 0.2.0 replaces the Korean/English keyword mapper with one fixed `CGO_ROUTING_V2` envelope. The hook performs structural checks only; the current Claude model classifies meaning in the same request. There is no language allow-list, translation dictionary, or extra classifier model call. This design broadens script and language reach, but it does not guarantee identical accuracy across languages or workloads.

## Marketplace status

This repository is a public custom Claude Code marketplace. Its root `.claude-plugin/marketplace.json` registers the `cgo` plugin, so no package-registry upload is required. This does not automatically place CGO in an Anthropic-managed curated catalog.

## Install and apply CGO

### Requirements

- Claude Code with plugin marketplace and MCP support
- Node.js 20 or newer
- A working Codex login or account entitlement for GPT-5.6 Sol

The CGO source is free and open source. Claude, Codex, GPT access, subscriptions, API usage, or quota may require paid plans.

### Install the official Codex dependency

Run inside Claude Code:

~~~text
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
~~~

CGO keeps the official Codex plugin external and does not vendor or fork it.

### Install CGO

~~~text
/plugin marketplace add umyunsang/claude-gpt-orchestrator
/plugin install cgo@claude-gpt-orchestrator-marketplace
~~~

Start a new Claude Code session so the hook and MCP server are loaded. Verify without calling a model:

~~~text
/cgo:doctor
~~~

### Use Claude Code normally

No CGO command or manual GPT switch is required. Example requests:

- `Design the authentication flow, then implement the approved design.`
- `Search the official documentation, then synthesize the evidence and limitations.`
- `Review this change without modifying files.`
- `Run regression QA and report exactly what passed.`

Simple explanation, translation, formatting, planning, design, and small routine work stay in Claude. A request is clarified once only when missing information changes the specialist role or permission path. Ambiguous, conflicting, or out-of-scope requests do not dispatch. A clear multi-role request is executed in dependency order and is not treated as ambiguity.

Optional observability commands:

~~~text
/cgo:status
/cgo:status task-example-id
/cgo:result task-example-id
~~~

Update an installed copy from a terminal, then restart Claude Code:

~~~text
claude plugin marketplace update claude-gpt-orchestrator-marketplace
claude plugin update cgo@claude-gpt-orchestrator-marketplace
~~~

## Responsibility and policy

| Owner | Responsibilities |
| --- | --- |
| Current Claude Code `/model` | Main reasoning, clarification, architecture, planning, orchestration, reconciliation, observability, final communication, accountability |
| GPT-5.6 Sol via the official Codex plugin | Bounded implementation, deep research, web research, review, and QA |
| CGO | Fixed semantic-routing context, deterministic policy enforcement, background dispatch, and observable status/result access |

| Role | Model | Effort | Mutation |
| --- | --- | --- | --- |
| IMPLEMENTATION | gpt-5.6-sol | xhigh | Approved current-project scope only |
| DEEP_RESEARCH | gpt-5.6-sol | high | Read-only |
| WEB_RESEARCH | gpt-5.6-sol | high | Read-only |
| REVIEW | gpt-5.6-sol | high | Read-only |
| QA | gpt-5.6-sol | high | Read-only |

CGO separates role classification from mutation intent. Only `IMPLEMENTATION + EXPLICIT` may receive `--write`. Read-only roles require `ABSENT`; conflicting intent never launches the companion. The MCP server requires all eight routing fields and rejects model, effort, mutation, cwd, executable, resume, background, provider, credential, and timeout overrides.

## How routing works

~~~text
normal non-slash Claude Code prompt
        |
        v
fixed CGO_ROUTING_V2 context
        |
        v
current Claude /model semantic decision
        |
        +-- simple / ambiguous / OOS --> Claude or one clarification
        |
        +-- clear specialist phase ----> validated CGO dispatch
                                             |
                                             v
                                  official codex@openai-codex
                                             |
                                             v
                                       GPT-5.6 Sol
                                             |
                                             v
                                  exact status/result -> Claude
~~~

Prompts whose trimmed form begins with `/` bypass the hook so native and plugin commands retain their normal behavior. Deterministic tests prove the envelope and policy, not live semantic accuracy. The public RouterBench development fixture supplies multilingual, code-switch, ambiguity, near-OOS, multi-role, and false-write gold records for later approved evaluation.

## Background lifecycle and observability

Dispatch uses the official `task --background --fresh --json` path and returns the official queued job ID without holding one shell or MCP call open for the entire specialist turn. Claude polls that exact ID with short status calls and retrieves the result after terminal status.

Official single-job and all-job JSON shapes are validated separately. If a queued or running record has a PID that no longer exists, CGO adds an `effectiveStatus: orphaned` observation without rewriting official state. This detects the visible consequence of a worker-start race; it does not repair or restart the official job. Cancellation and automatic resume are not exposed.

Receipts prove the validated request, enforced policy, official job ID, and observed execution fields. Exact result retrieval requires both returned job identities to equal the requested full ID. The persisted specialist prompt is redacted from the result tool response so it is not duplicated into the Claude transcript. Receipts do not provide provider-attested effective model identity, so that field remains `UNKNOWN_UNTIL_INSTRUMENTED`.

## Local data, security, and retention

Tracked background execution requires the official companion to persist the full specialist prompt and request locally until the worker and result flow can use it. CGO resolves a dedicated plugin-data directory, rejects a symbolic-link root or a root owned by another user, and enforces mode `0700` on that directory before companion discovery or execution. This prevents other local accounts from traversing the stored job data under normal filesystem permissions.

The official companion 1.0.6 retains up to the latest 50 jobs in its state and prunes older job files and associated logs as newer jobs are added. CGO does not currently expose a purge command. Treat the local data directory as sensitive, especially on shared systems, and see [SECURITY.md](SECURITY.md) for the exact boundary.

No credentials are bundled or accepted through CGO arguments. The companion must resolve through the installed `codex@openai-codex` registry entry and realpath inside the official OpenAI marketplace cache. Specialist prompts are passed as argv without a shell.

## Why CGO

CGO is built around a cost/performance thesis: spend Claude's main-context budget on high-leverage understanding, design, coordination, acceptance, and accountability; move token-heavy specialist execution to GPT-5.6 Sol while keeping one Claude Code conversation and a receipt trail.

Claude can perform every specialist role itself. CGO does not claim that one model universally wins. Price, quota, latency, and quality vary by account, date, and workload; validate the split on representative tasks.

## Current limitations

- Language-agnostic means no language allow-list, not universal or equal accuracy.
- Live RouterBench accuracy and false-write statistics require a separate approved model evaluation.
- Cancellation, automatic resume, and server-enforced cross-call workflow ordering are not exposed.
- CGO is contract-tested against official `codex@openai-codex` 1.0.6. Later compatible 1.x versions still require contract verification.
- Effective provider/model identity is not attested by the current official receipt.

## License and names

CGO is licensed under Apache-2.0. The official OpenAI plugin is an external dependency and is not vendored.

This independent project is not affiliated with, endorsed by, or sponsored by Anthropic or OpenAI. Claude, Claude Code, Codex, GPT, OpenAI, and Anthropic may be trademarks of their respective owners.
