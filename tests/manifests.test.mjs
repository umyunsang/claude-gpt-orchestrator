import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

test("marketplace and plugin manifests declare the portable dependency boundary", () => {
  const marketplace = readJson(".claude-plugin/marketplace.json");
  assert.equal(marketplace.name, "claude-gpt-orchestrator-marketplace");
  assert.ok(marketplace.allowCrossMarketplaceDependenciesOn.includes("openai-codex"));
  assert.equal(marketplace.plugins[0].source, "./plugins/cgo");
  assert.equal(marketplace.plugins[0].version, "0.1.0");

  const plugin = readJson(
    "plugins/cgo/.claude-plugin/plugin.json"
  );
  assert.equal(plugin.name, "cgo");
  assert.equal(plugin.displayName, "Claude GPT Orchestrator (CGO)");
  assert.equal(plugin.version, "0.1.0");
  assert.equal(plugin.license, "Apache-2.0");
  assert.deepEqual(plugin.dependencies, [{
    name: "codex",
    marketplace: "openai-codex"
  }]);
  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.equal(plugin.hooks, undefined);
  assert.ok(fs.existsSync("plugins/cgo/hooks/hooks.json"));
});

test("MCP manifest uses plugin path variables and no machine-local paths", () => {
  const mcp = readJson("plugins/cgo/.mcp.json");
  const serialized = JSON.stringify(mcp);
  assert.match(serialized, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.match(serialized, /\$\{CLAUDE_PROJECT_DIR\}/);
  assert.match(serialized, /\$\{CLAUDE_PLUGIN_DATA\}/);
  assert.doesNotMatch(serialized, /\/Users\//);
});

test("public package includes required legal and maintainer documents", () => {
  for (const file of [
    "README.md",
    "LICENSE",
    "NOTICE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md"
  ]) {
    assert.ok(fs.existsSync(file), `${file} is required`);
  }
  assert.match(fs.readFileSync("LICENSE", "utf8"), /Apache License/);
  assert.match(fs.readFileSync("README.md", "utf8"), /not affiliated/i);
  assert.match(fs.readFileSync("README.md", "utf8"), /may require.*subscription|subscription.*may require/i);
});
