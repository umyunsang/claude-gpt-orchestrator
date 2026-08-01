import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sourceRoot = fs.realpathSync.native(path.resolve("."));
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cgo-update-"));
const configDir = path.join(fixtureRoot, "claude-config");
const officialMarketplace = path.join(fixtureRoot, "official-marketplace");
const cgoMarketplace = path.join(fixtureRoot, "cgo-marketplace");

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function run(args, cwd = sourceRoot) {
  const result = spawnSync("claude", args, {
    cwd,
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
    encoding: "utf8",
    timeout: 60000
  });
  assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result.stdout;
}

function installedVersion() {
  const installed = JSON.parse(run(["plugin", "list", "--json"]));
  return installed.find((plugin) => plugin.id === "cgo@claude-gpt-orchestrator-marketplace")?.version;
}

try {
  writeJson(path.join(officialMarketplace, ".claude-plugin", "marketplace.json"), {
    name: "openai-codex",
    owner: { name: "Fixture only" },
    plugins: [{ name: "codex", version: "1.0.6", source: "./plugins/codex" }]
  });
  writeJson(path.join(officialMarketplace, "plugins", "codex", ".claude-plugin", "plugin.json"), {
    name: "codex",
    version: "1.0.6",
    description: "Fake install-only dependency fixture"
  });

  fs.cpSync(sourceRoot, cgoMarketplace, {
    recursive: true,
    filter(source) {
      return !source.includes(`${path.sep}.git${path.sep}`) &&
        !source.endsWith(`${path.sep}.git`) &&
        !source.includes(`${path.sep}node_modules${path.sep}`);
    }
  });
  const pluginPath = path.join(cgoMarketplace, "plugins", "cgo", ".claude-plugin", "plugin.json");
  const plugin = JSON.parse(fs.readFileSync(pluginPath, "utf8"));
  writeJson(pluginPath, { ...plugin, version: "0.1.0" });

  run(["plugin", "marketplace", "add", officialMarketplace, "--scope", "user"]);
  run(["plugin", "marketplace", "add", cgoMarketplace, "--scope", "user"]);
  run(["plugin", "install", "cgo@claude-gpt-orchestrator-marketplace", "--scope", "user"]);
  assert.equal(installedVersion(), "0.1.0");

  writeJson(pluginPath, { ...plugin, version: "0.2.0" });
  run(["plugin", "marketplace", "update", "claude-gpt-orchestrator-marketplace"]);
  run(["plugin", "update", "cgo@claude-gpt-orchestrator-marketplace"]);
  assert.equal(installedVersion(), "0.2.0");

  process.stdout.write(JSON.stringify({
    status: "PASS",
    from: "0.1.0",
    to: "0.2.0",
    modelCalls: 0
  }) + "\n");
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
