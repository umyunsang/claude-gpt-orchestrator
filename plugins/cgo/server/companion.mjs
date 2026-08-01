import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MINIMUM_CODEX_PLUGIN_VERSION = "1.0.6";

function defaultConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

function isInside(child, parent) {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version));
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function resolveOfficialCompanion({ configDir = defaultConfigDir() } = {}) {
  const registryPath = path.join(configDir, "plugins", "installed_plugins.json");
  const cacheBase = path.join(
    configDir,
    "plugins",
    "cache",
    "openai-codex",
    "codex"
  );

  let registry;
  let realCacheBase;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    realCacheBase = fs.realpathSync.native(cacheBase);
  } catch (error) {
    throw new Error(
      `Cannot inspect the installed official Codex plugin: ${error.message}`
    );
  }

  const pluginRegistry = registry.plugins ?? registry;
  const installs = Array.isArray(pluginRegistry["codex@openai-codex"])
    ? pluginRegistry["codex@openai-codex"]
    : [];

  const candidates = [];
  for (const entry of installs) {
    try {
      const installPath = fs.realpathSync.native(String(entry.installPath ?? ""));
      const companionPath = fs.realpathSync.native(
        path.join(installPath, "scripts", "codex-companion.mjs")
      );
      if (!isInside(installPath, realCacheBase)) continue;
      if (!isInside(companionPath, installPath)) continue;
      if (!isInside(companionPath, realCacheBase)) continue;
      candidates.push({
        path: companionPath,
        installPath,
        version: String(entry.version ?? ""),
        updatedAt: String(entry.lastUpdated ?? entry.installedAt ?? ""),
        marketplace: "openai-codex",
        plugin: "codex"
      });
    } catch {
      // Ignore stale or malformed registry entries.
    }
  }

  candidates.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  if (candidates.length === 0) {
    throw new Error(
      "No installed official Codex companion was found inside the openai-codex cache."
    );
  }
  return candidates[0];
}

export function inspectOfficialCompanion(options = {}) {
  try {
    const resolved = resolveOfficialCompanion(options);
    const parsed = parseVersion(resolved.version);
    const comparison = compareVersions(
      resolved.version,
      MINIMUM_CODEX_PLUGIN_VERSION
    );
    const compatible = Boolean(parsed) && parsed[0] === 1 && comparison >= 0;
    return {
      ok: true,
      compatible,
      minimumVersion: MINIMUM_CODEX_PLUGIN_VERSION,
      ...resolved,
      message: compatible
        ? `Official codex@openai-codex ${resolved.version} is compatible.`
        : `Official codex@openai-codex must be >= ${MINIMUM_CODEX_PLUGIN_VERSION} and < 2.0.0; found ${resolved.version || "unknown"}.`
    };
  } catch (error) {
    return {
      ok: false,
      compatible: false,
      minimumVersion: MINIMUM_CODEX_PLUGIN_VERSION,
      message: error.message
    };
  }
}
