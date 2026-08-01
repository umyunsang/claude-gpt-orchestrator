import { spawnSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 4 * 60 * 60 * 1000;
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const JOB_ID_PATTERN = /^[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]{0,127}$/;

export function validateJobId(jobId) {
  if (typeof jobId !== "string" || !JOB_ID_PATTERN.test(jobId)) {
    throw new Error("job_id must be a safe Codex job identifier.");
  }
  return jobId;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireShape(condition, operation, detail) {
  if (!condition) {
    throw new Error(`Codex ${operation} returned an incompatible JSON receipt: ${detail}.`);
  }
}

export function parseStructuredOutput(text, operation = "companion") {
  let payload;
  try {
    payload = JSON.parse(String(text).trim());
  } catch {
    throw new Error(`Codex ${operation} did not return valid JSON.`);
  }
  requireShape(isObject(payload), operation, "expected an object");

  if (operation === "task") {
    requireShape(
      Number.isInteger(payload.status) && (payload.status === 0 || payload.status === 1),
      operation,
      "status must be 0 or 1"
    );
    requireShape(
      typeof payload.threadId === "string" || payload.threadId === null,
      operation,
      "missing threadId"
    );
    requireShape(typeof payload.rawOutput === "string", operation, "missing rawOutput");
    requireShape(Array.isArray(payload.touchedFiles), operation, "missing touchedFiles");
  }
  if (operation === "status") {
    requireShape(Array.isArray(payload.running), operation, "missing running array");
    requireShape(Array.isArray(payload.recent), operation, "missing recent array");
    requireShape(
      payload.latestFinished === null || isObject(payload.latestFinished),
      operation,
      "missing latestFinished"
    );
  }
  if (operation === "result") {
    requireShape(isObject(payload.job), operation, "missing job");
    requireShape(isObject(payload.storedJob), operation, "missing storedJob");
  }

  return payload;
}

function collectJob(job, ids) {
  if (isObject(job) && typeof job.id === "string" && JOB_ID_PATTERN.test(job.id)) {
    ids.push(job.id);
  }
}

export function extractStructuredJobIds(payload) {
  if (!isObject(payload)) return [];
  const ids = [];
  collectJob(payload.job, ids);
  collectJob(payload.storedJob, ids);
  for (const key of ["jobs", "running"]) {
    if (!Array.isArray(payload[key])) continue;
    for (const job of payload[key]) collectJob(job, ids);
  }
  collectJob(payload.latestFinished, ids);
  if (Array.isArray(payload.recent)) {
    for (const job of payload.recent) collectJob(job, ids);
  }
  if (typeof payload.jobId === "string" && JOB_ID_PATTERN.test(payload.jobId)) {
    ids.push(payload.jobId);
  }
  return [...new Set(ids)];
}

export function runProcess({
  command,
  args,
  projectDir,
  pluginData,
  env = process.env,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  operation = args[1] ?? "companion"
}) {
  const result = spawnSync(command, args, {
    cwd: projectDir,
    env: {
      ...env,
      CLAUDE_PLUGIN_DATA: pluginData
    },
    encoding: "utf8",
    maxBuffer: MAX_BUFFER_BYTES,
    timeout: timeoutMs
  });

  if (result.error) {
    throw new Error(`Codex companion failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `Codex companion exited with status ${result.status}${detail ? `: ${detail}` : "."}`
    );
  }
  const payload = parseStructuredOutput(result.stdout ?? "", operation);
  return {
    exitCode: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    payload,
    jobIds: extractStructuredJobIds(payload)
  };
}

export function runObservation({
  companionPath,
  operation,
  jobId,
  projectDir,
  pluginData,
  env = process.env
}) {
  if (!["status", "result"].includes(operation)) {
    throw new Error(`Unsupported observation operation: ${operation}.`);
  }
  const args = [companionPath, operation];
  if (operation === "status") {
    if (jobId === undefined) args.push("--all");
    else args.push(validateJobId(jobId));
  } else {
    args.push(validateJobId(jobId));
  }
  args.push("--json");
  return runProcess({
    command: process.execPath,
    args,
    projectDir,
    pluginData,
    env,
    operation
  });
}
