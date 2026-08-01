import { spawnSync } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 30 * 1000;
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;
const JOB_ID_PATTERN = /^[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]{0,127}$/;
const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

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
      typeof payload.jobId === "string" && JOB_ID_PATTERN.test(payload.jobId),
      operation,
      "jobId must be a safe Codex job identifier"
    );
    requireShape(
      payload.status === "queued",
      operation,
      "status must be queued"
    );
    requireShape(typeof payload.title === "string" && payload.title.length > 0, operation, "missing title");
    requireShape(typeof payload.summary === "string", operation, "missing summary");
    requireShape(typeof payload.logFile === "string" && payload.logFile.length > 0, operation, "missing logFile");
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
  if (operation === "status-one") {
    requireShape(isObject(payload.job), operation, "missing job");
    requireShape(
      typeof payload.job.id === "string" && JOB_ID_PATTERN.test(payload.job.id),
      operation,
      "job.id must be a safe Codex job identifier"
    );
  }
  if (operation === "result") {
    requireShape(isObject(payload.job), operation, "missing job");
    requireShape(isObject(payload.storedJob), operation, "missing storedJob");
    requireShape(
      typeof payload.job.id === "string" && JOB_ID_PATTERN.test(payload.job.id),
      operation,
      "job.id must be a safe Codex job identifier"
    );
    requireShape(
      typeof payload.storedJob.id === "string" && JOB_ID_PATTERN.test(payload.storedJob.id),
      operation,
      "storedJob.id must be a safe Codex job identifier"
    );
    requireShape(
      payload.job.id === payload.storedJob.id,
      operation,
      "job identities do not match"
    );
    requireShape(
      TERMINAL_STATUSES.has(payload.job.status) && TERMINAL_STATUSES.has(payload.storedJob.status),
      operation,
      "job and storedJob must have terminal statuses"
    );
  }

  return payload;
}

function isProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    return null;
  }
}

function annotateJobLiveness(job) {
  if (!isObject(job) || !["queued", "running"].includes(job.status)) return job;
  if (isProcessAlive(job.pid) !== false) return job;
  return {
    ...job,
    effectiveStatus: "orphaned",
    orphanReason: "PROCESS_NOT_RUNNING"
  };
}

export function annotateObservationLiveness(payload) {
  if (!isObject(payload)) return payload;
  const next = { ...payload };
  if (isObject(next.job)) next.job = annotateJobLiveness(next.job);
  if (Array.isArray(next.running)) next.running = next.running.map(annotateJobLiveness);
  return next;
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
  operation = args[1] ?? "companion",
  expectedJobId
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
    if (result.error.code === "ETIMEDOUT") {
      throw new Error(`Codex ${operation} exceeded the ${timeoutMs}ms enqueue/observation deadline.`);
    }
    throw new Error(`Codex companion failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `Codex companion exited with status ${result.status}${detail ? `: ${detail}` : "."}`
    );
  }
  let payload = parseStructuredOutput(result.stdout ?? "", operation);
  if (operation === "status-one") {
    requireShape(payload.job.id === expectedJobId, operation, "job.id does not match the requested job");
  }
  if (operation === "result") {
    requireShape(
      payload.job.id === expectedJobId && payload.storedJob.id === expectedJobId,
      operation,
      "job identity does not match the requested job"
    );
  }
  if (operation === "status" || operation === "status-one") {
    payload = annotateObservationLiveness(payload);
  }
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
    operation: operation === "status" && jobId !== undefined ? "status-one" : operation,
    expectedJobId: jobId
  });
}
