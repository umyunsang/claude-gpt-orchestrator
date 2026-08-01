import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = fs.realpathSync.native(path.resolve("."));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cgo-install-"));
const configDir = path.join(fixtureRoot, "claude-config");
const officialMarketplace = path.join(fixtureRoot, "official-marketplace");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function run(args) {
  const result = spawnSync("claude", args, {
    cwd: root,
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: configDir
    },
    encoding: "utf8",
    timeout: 60000
  });
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join("\n")
  );
  return result.stdout;
}

try {
  writeJson(
    path.join(officialMarketplace, ".claude-plugin", "marketplace.json"),
    {
      name: "openai-codex",
      owner: { name: "Fixture only" },
      plugins: [{
        name: "codex",
        version: "1.0.6",
        source: "./plugins/codex"
      }]
    }
  );
  writeJson(
    path.join(
      officialMarketplace,
      "plugins",
      "codex",
      ".claude-plugin",
      "plugin.json"
    ),
    {
      name: "codex",
      version: "1.0.6",
      description: "Fake install-only dependency fixture"
    }
  );

  run(["plugin", "marketplace", "add", officialMarketplace, "--scope", "user"]);
  run(["plugin", "marketplace", "add", root, "--scope", "user"]);
  run([
    "plugin",
    "install",
    "cgo@claude-gpt-orchestrator-marketplace",
    "--scope",
    "user"
  ]);

  const installed = JSON.parse(run(["plugin", "list", "--json"]));
  const cgo = installed.find(
    (plugin) => plugin.id === "cgo@claude-gpt-orchestrator-marketplace"
  );
  const codex = installed.find(
    (plugin) => plugin.id === "codex@openai-codex"
  );
  assert.ok(cgo, "CGO must be installed");
  assert.ok(codex, "the declared Codex dependency must be auto-installed");
  assert.equal(cgo.version, "0.1.0");
  assert.deepEqual(cgo.errors ?? [], []);
  assert.equal(cgo.mcpServers?.cgo?.command, "node");

  run([
    "plugin",
    "uninstall",
    "cgo@claude-gpt-orchestrator-marketplace",
    "--scope",
    "user",
    "--prune",
    "--yes"
  ]);
  const remaining = JSON.parse(run(["plugin", "list", "--json"]));
  assert.equal(
    remaining.some((plugin) => plugin.id === "cgo@claude-gpt-orchestrator-marketplace"),
    false
  );
  assert.equal(
    remaining.some((plugin) => plugin.id === "codex@openai-codex"),
    false
  );

  process.stdout.write(JSON.stringify({
    status: "PASS",
    installed: ["cgo@claude-gpt-orchestrator-marketplace", "codex@openai-codex"],
    errors: [],
    uninstallPrune: "PASS"
  }) + "\n");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
