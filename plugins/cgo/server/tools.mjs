import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  inspectOfficialCompanion,
  resolveOfficialCompanion
} from "./companion.mjs";
import {
  REQUIRED_MODEL,
  buildTaskInvocation
} from "./policy.mjs";
import {
  runObservation,
  runProcess,
  validateJobId
} from "./runner.mjs";

const ROLE_ENUM = [
  "IMPLEMENTATION",
  "DEEP_RESEARCH",
  "WEB_RESEARCH",
  "REVIEW",
  "QA"
];

export const TOOL_DEFINITIONS = [
  {
    name: "dispatch",
    description: "Dispatch one bounded specialist task to GPT through the official Codex plugin. Model, effort, write access, current project, fresh-thread mode, and foreground execution are enforced by CGO.",
    inputSchema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ROLE_ENUM,
          description: "Specialist role selected from the fixed CGO policy."
        },
        brief: {
          type: "string",
          minLength: 1,
          maxLength: 120000,
          description: "Self-contained task contract for the specialist."
        }
      },
      required: ["role", "brief"],
      additionalProperties: false
    }
  },
  {
    name: "status",
    description: "Read Codex job status for the current project, optionally narrowed to one safe job ID.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "result",
    description: "Read the stored result for one safe Codex job ID in the current project.",
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" }
      },
      required: ["job_id"],
      additionalProperties: false
    }
  },
  {
    name: "doctor",
    description: "Check CGO, project, Node, and official Codex plugin compatibility without calling a model.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  }
];

function exactObject(value, allowedKeys) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tool arguments must be an object.");
  }
  const unexpected = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected argument(s): ${unexpected.join(", ")}.`);
  }
  return value;
}

function resolveRuntime(env) {
  const projectCandidate = env.CGO_PROJECT_DIR || process.cwd();
  let projectDir;
  try {
    projectDir = fs.realpathSync.native(projectCandidate);
    if (!fs.statSync(projectDir).isDirectory()) {
      throw new Error("not a directory");
    }
  } catch (error) {
    throw new Error(`Cannot resolve the fixed Claude project directory: ${error.message}`);
  }
  return {
    projectDir,
    pluginData: env.CGO_PLUGIN_DATA || path.join(os.tmpdir(), "cgo"),
    configDir: env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude")
  };
}

function textResult(payload, isError = false) {
  return {
    content: [{
      type: "text",
      text: typeof payload === "string"
        ? payload
        : JSON.stringify(payload, null, 2)
    }],
    isError
  };
}

function observationPayload(operation, output) {
  return {
    operation,
    receipt: output.payload,
    stderr: output.stderr,
    observedJobIds: output.jobIds
  };
}

function statusJobs(payload) {
  return [
    ...(Array.isArray(payload?.running) ? payload.running : []),
    ...(payload?.latestFinished ? [payload.latestFinished] : []),
    ...(Array.isArray(payload?.recent) ? payload.recent : [])
  ];
}

function correlateFreshTask(statusPayload, taskPayload) {
  const threadId = taskPayload?.threadId;
  if (typeof threadId !== "string" || !threadId) return null;
  const matches = statusJobs(statusPayload).filter((job) => job?.threadId === threadId);
  return matches.length === 1 ? matches[0] : null;
}

export function callTool(name, rawArguments, env = process.env) {
  try {
    const runtime = resolveRuntime(env);

    if (name === "doctor") {
      exactObject(rawArguments, []);
      const plugin = inspectOfficialCompanion({ configDir: runtime.configDir });
      return textResult({
        product: "Claude GPT Orchestrator (CGO)",
        version: "0.1.0",
        node: process.version,
        projectDir: runtime.projectDir,
        pluginData: runtime.pluginData,
        requestedModel: REQUIRED_MODEL,
        modelCallPerformed: false,
        officialCodexPlugin: plugin
      });
    }

    const plugin = inspectOfficialCompanion({ configDir: runtime.configDir });
    if (!plugin.ok || !plugin.compatible) {
      throw new Error(plugin.message);
    }
    const companion = resolveOfficialCompanion({ configDir: runtime.configDir });

    if (name === "dispatch") {
      const args = exactObject(rawArguments, ["role", "brief"]);
      const invocation = buildTaskInvocation({
        role: args.role,
        brief: args.brief,
        companionPath: companion.path
      });
      const output = runProcess({
        command: invocation.command,
        args: invocation.args,
        projectDir: runtime.projectDir,
        pluginData: runtime.pluginData,
        env,
        operation: "task"
      });
      const statusOutput = runObservation({
        companionPath: companion.path,
        operation: "status",
        projectDir: runtime.projectDir,
        pluginData: runtime.pluginData,
        env
      });
      const correlatedJob = correlateFreshTask(statusOutput.payload, output.payload);
      return textResult({
        operation: "dispatch",
        role: invocation.contract.role,
        requestedModel: invocation.contract.model,
        effort: invocation.contract.effort,
        mutationPolicy: invocation.contract.write ? "workspace-write" : "read-only",
        threadMode: "fresh",
        execution: "foreground",
        effectiveIdentity: "UNKNOWN_UNTIL_INSTRUMENTED",
        taskReceipt: output.payload,
        correlatedJob,
        jobId: correlatedJob?.id ?? null,
        stderr: output.stderr,
        observedJobIds: correlatedJob?.id ? [correlatedJob.id] : [],
        correlation: correlatedJob
          ? "MATCHED_BY_FRESH_THREAD_ID"
          : "UNRESOLVED_NO_UNIQUE_THREAD_MATCH"
      });
    }

    if (name === "status") {
      const args = exactObject(rawArguments, ["job_id"]);
      if (args.job_id !== undefined) validateJobId(args.job_id);
      return textResult(observationPayload(
        "status",
        runObservation({
          companionPath: companion.path,
          operation: "status",
          jobId: args.job_id,
          projectDir: runtime.projectDir,
          pluginData: runtime.pluginData,
          env
        })
      ));
    }

    if (name === "result") {
      const args = exactObject(rawArguments, ["job_id"]);
      validateJobId(args.job_id);
      return textResult(observationPayload(
        "result",
        runObservation({
          companionPath: companion.path,
          operation: "result",
          jobId: args.job_id,
          projectDir: runtime.projectDir,
          pluginData: runtime.pluginData,
          env
        })
      ));
    }

    throw new Error(`Unknown CGO tool: ${name}.`);
  } catch (error) {
    return textResult({ error: error.message }, true);
  }
}
