# Security policy

## Supported versions

Only the latest 0.1.x release is supported during the initial preview.

## Reporting

After the GitHub repository is published, use GitHub private vulnerability reporting. Do not open a public issue for credential exposure, path-boundary bypasses, command execution, or permission-policy bypasses.

Until a private reporting channel is configured, do not publish a suspected vulnerability or any credential. Keep a minimal reproduction locally and contact the repository owner through a private channel.

## Threat boundary

CGO treats natural-language prompts, MCP arguments, plugin registry entries, filesystem paths, job IDs, and companion output as untrusted.

Security invariants:

- only the official codex@openai-codex registry entry is accepted;
- the companion realpath must remain inside the official marketplace cache;
- dispatch accepts only role and brief;
- model, effort, mutation, cwd, executable, resume, and background settings are fixed;
- no shell interprets the specialist brief;
- only IMPLEMENTATION is write-capable;
- status/result job identifiers are allowlisted;
- doctor performs no model call.

CGO does not manage Claude, Codex, OpenAI, or Anthropic credentials.
