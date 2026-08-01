import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeFixture({
  version = "1.0.6",
  installOutsideCache = false
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cgo-"));
  const configDir = path.join(root, "claude-config");
  const cacheBase = path.join(configDir, "plugins", "cache", "openai-codex", "codex");
  const installPath = installOutsideCache
    ? path.join(root, "outside", version)
    : path.join(cacheBase, version);
  const scriptsDir = path.join(installPath, "scripts");
  const registryPath = path.join(configDir, "plugins", "installed_plugins.json");
  const projectDir = path.join(root, "project");
  const pluginData = path.join(root, "plugin-data");
  const tracePath = path.join(root, "trace.ndjson");

  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(pluginData, { recursive: true });
  fs.copyFileSync(
    new URL("./fixtures/fake-codex-companion.mjs", import.meta.url),
    path.join(scriptsDir, "codex-companion.mjs")
  );
  fs.writeFileSync(
    path.join(installPath, ".claude-plugin.json"),
    JSON.stringify({ name: "codex", version })
  );
  fs.writeFileSync(
    registryPath,
    JSON.stringify({
      plugins: {
        "codex@openai-codex": [{
          scope: "user",
          installPath,
          version,
          installedAt: "2026-08-01T00:00:00.000Z",
          lastUpdated: "2026-08-01T00:00:00.000Z"
        }]
      }
    })
  );

  return {
    root,
    configDir,
    cacheBase,
    installPath,
    companionPath: path.join(scriptsDir, "codex-companion.mjs"),
    projectDir,
    pluginData,
    tracePath,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

export function parseResponses(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
