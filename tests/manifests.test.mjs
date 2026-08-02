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
  assert.equal(marketplace.version, "0.2.1");
  assert.equal(marketplace.plugins[0].version, undefined);

  const plugin = readJson(
    "plugins/cgo/.claude-plugin/plugin.json"
  );
  assert.equal(plugin.name, "cgo");
  assert.equal(plugin.displayName, "Claude GPT Orchestrator (CGO)");
  assert.equal(plugin.version, "0.2.1");
  assert.equal(plugin.license, "Apache-2.0");
  assert.deepEqual(plugin.dependencies, [{
    name: "codex",
    marketplace: "openai-codex"
  }]);
  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.equal(plugin.hooks, undefined);
  assert.ok(fs.existsSync("plugins/cgo/hooks/hooks.json"));
});

test("all package and runtime version surfaces agree on 0.2.1", () => {
  const packageJson = readJson("package.json");
  const lock = readJson("package-lock.json");
  assert.equal(packageJson.version, "0.2.1");
  assert.equal(lock.version, "0.2.1");
  assert.equal(lock.packages[""].version, "0.2.1");
  assert.match(fs.readFileSync("plugins/cgo/server/server.mjs", "utf8"), /version: "0\.2\.1"/);
  assert.match(fs.readFileSync("plugins/cgo/server/tools.mjs", "utf8"), /version: "0\.2\.1"/);
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
    "CHANGELOG.md",
    "DEPLOYMENT.md"
  ]) {
    assert.ok(fs.existsSync(file), `${file} is required`);
  }
  assert.equal(fs.existsSync("POSITIONING.md"), false, "internal positioning memo must not ship");
  assert.match(fs.readFileSync("LICENSE", "utf8"), /Apache License/);
  assert.match(fs.readFileSync("README.md", "utf8"), /not affiliated/i);
  assert.match(fs.readFileSync("README.md", "utf8"), /may require.*subscription|subscription.*may require/i);
});

test("public documentation states the v2 language, privacy, and proof boundaries", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const security = fs.readFileSync("SECURITY.md", "utf8");
  const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
  assert.doesNotMatch(readme, /[가-힣]/, "README examples and prose must remain English-only");
  assert.doesNotMatch(readme, /Fixed v0\.1\.0 policy|classifier is deterministic/i);
  assert.match(readme, /no language allow-list/i);
  assert.match(readme, /does not guarantee identical accuracy/i);
  assert.match(readme, /simple.*stay.*Claude/i);
  assert.match(readme, /clarif.*once/i);
  assert.match(readme, /0700/);
  assert.match(readme, /50.*jobs|jobs.*50/i);
  assert.match(security, /0700/);
  assert.match(security, /full.*prompt|prompt.*full/i);
  assert.match(security, /50.*jobs|jobs.*50/i);
  assert.match(changelog, /## 0\.2\.0 - 2026-08-02/);
});

test("public documentation is production-facing and operationally complete", () => {
  const readme = fs.readFileSync("README.md", "utf8");
  const deployment = fs.readFileSync("DEPLOYMENT.md", "utf8");

  for (const internalPhrase of [
    /RouterBench/i,
    /gold records/i,
    /product thesis/i,
    /approved model evaluation/i,
    /locally observed evidence/i
  ]) {
    assert.doesNotMatch(readme, internalPhrase);
    assert.doesNotMatch(deployment, internalPhrase);
  }

  assert.match(readme, /automatic routing/i);
  assert.match(readme, /restart Claude Code/i);
  assert.match(readme, /production deployment/i);
  assert.doesNotMatch(readme, /claude plugin (?:marketplace add|install)/i);
  assert.match(readme, /\/plugin marketplace add openai\/codex-plugin-cc/);
  assert.match(readme, /\/plugin install codex@openai-codex/);
  assert.match(readme, /\/codex:setup/);
  assert.match(readme, /Python 3 installed globally/i);
  assert.match(deployment, /\/plugin marketplace add openai\/codex-plugin-cc/);
  assert.match(deployment, /\/codex:setup/);
  assert.match(deployment, /Python 3 is installed globally/i);
  assert.ok(
    readme.indexOf("Python 3") < readme.indexOf("/codex:setup") &&
      readme.indexOf("/codex:setup") < readme.indexOf("/plugin marketplace add umyunsang/claude-gpt-orchestrator"),
    "Python and Codex setup must precede CGO installation"
  );
  assert.match(readme, /actions\/workflows\/ci\.yml\/badge\.svg/);
  assert.match(readme, /img\.shields\.io\/github\/stars/);
  assert.match(readme, /star (CGO|the repository)/i);
  assert.ok(
    readme.indexOf("## Quick start") > 0 && readme.indexOf("## Quick start") < 3500,
    "Quick start must remain visible near the top of the README"
  );
  assert.match(deployment, /pre-deployment/i);
  assert.match(deployment, /post-deployment/i);
  assert.match(deployment, /rollback/i);
  assert.match(deployment, /read-only.*not.*read isolation/i);
  assert.match(deployment, /UNKNOWN_UNTIL_INSTRUMENTED/);
  assert.match(deployment, /--keep-data/);
});
