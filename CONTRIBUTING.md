# Contributing

CGO is intentionally thin. Contributions should preserve the normal Claude Code conversation, fixed role boundaries, official Codex dependency, and observable receipts.

## Development

Requirements:

- Node.js 20 or newer
- Claude Code for strict plugin manifest validation

Run:

~~~text
npm test
claude plugin validate . --strict
~~~

Tests use a fake local Codex companion and must not require credentials or a live model call.

## Change rules

- Add a failing behavioral test before changing routing or policy.
- Never add a model, effort, write, cwd, executable, resume, background, or credential override to public tool arguments.
- Keep review, research, and QA read-only.
- Preserve unrelated user files and avoid global configuration mutation.
- Keep public documentation operational, evidence-bounded, and free of internal planning notes.
- Update `DEPLOYMENT.md` when installation, permissions, storage, updates, or rollback behavior changes.
- Update CHANGELOG.md for user-visible behavior.

Use focused commits and describe the exact verification scope in pull requests.
