import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  inspectOfficialCompanion,
  resolveOfficialCompanion
} from "./companion.mjs";
import {
  CLASSIFIER_PROVENANCE,
  CONFIDENCE_PROVENANCE,
  DECISION_STATE_ENUM,
  REQUIRED_MODEL,
  ROLE_ENUM,
  ROUTER_CONTRACT,
  WRITE_INTENT_ENUM,
  buildTaskInvocation,
  validateDispatchRequest
} from "./policy.mjs";
import {
  runObservation,
  runProcess,
  validateJobId
} from "./runner.mjs";

export const TOOL_DEFINITIONS = [
  {
    name: "dispatch",
    description: "Enqueue one bounded specialist task through the official Codex plugin. Model, effort, write access, current project, fresh-thread mode, and tracked background execution are enforced by CGO.",
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
        },
        router_contract: {
          type: "string",
          const: ROUTER_CONTRACT
        },
        decision_state: {
          type: "string",
          enum: DECISION_STATE_ENUM
        },
        write_intent: {
          type: "string",
          enum: WRITE_INTENT_ENUM
        },
        workflow_id: {
          anyOf: [
            { type: "null" },
            { type: "string", pattern: "^cgo-workflow-[a-z0-9][a-z0-9-]{0,114}$" }
          ]
        },
        sequence_index: { type: "integer", minimum: 1, maximum: 5 },
        sequence_total: { type: "integer", minimum: 1, maximum: 5 }
      },
      required: [
        "role",
        "brief",
        "router_contract",
        "decision_state",
        "write_intent",
        "workflow_id",
        "sequence_index",
        "sequence_total"
      ],
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

function ensurePrivatePluginData(candidate) {
  const pluginData = path.resolve(candidate);
  if (fs.existsSync(pluginData)) {
    const existing = fs.lstatSync(pluginData);
    if (existing.isSymbolicLink()) {
      throw new Error("The CGO plugin data root must not be a symbolic link.");
    }
    if (!existing.isDirectory()) {
      throw new Error("The CGO plugin data root must be a directory.");
    }
  } else {
    fs.mkdirSync(pluginData, { recursive: true, mode: 0o700 });
  }

  const resolved = fs.realpathSync.native(pluginData);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error("The CGO plugin data root must be a real directory.");
  }
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error("The CGO plugin data root must be owned by the current user.");
  }
  fs.chmodSync(resolved, 0o700);
  if ((fs.statSync(resolved).mode & 0o777) !== 0o700) {
    throw new Error("The CGO plugin data root must have mode 0700.");
  }
  return resolved;
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
  const configDir = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const pluginDataCandidate = env.CGO_PLUGIN_DATA ||
    env.CLAUDE_PLUGIN_DATA ||
    path.join(configDir, "plugins", "data", "cgo");
  return {
    projectDir,
    pluginData: ensurePrivatePluginData(pluginDataCandidate),
    configDir
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

function sanitizeObservationReceipt(operation, payload) {
  if (operation !== "result" || !payload?.storedJob?.request) {
    return { receipt: payload, redactions: [] };
  }
  const { prompt: _prompt, ...safeRequest } = payload.storedJob.request;
  return {
    receipt: {
      ...payload,
      storedJob: {
        ...payload.storedJob,
        request: safeRequest
      }
    },
    redactions: ["storedJob.request.prompt"]
  };
}

function observationPayload(operation, output, requestedJobId = null) {
  const observedJob = output.payload.job ?? output.payload.storedJob ?? null;
  const sanitized = sanitizeObservationReceipt(operation, output.payload);
  return {
    operation,
    receipt: sanitized.receipt,
    receiptRedactions: sanitized.redactions,
    requestedJobId,
    codexThreadId: observedJob?.threadId ?? null,
    stderrPresent: Boolean(output.stderr),
    observedJobIds: output.jobIds
  };
}

export function callTool(name, rawArguments, env = process.env) {
  try {
    const dispatchRequest = name === "dispatch"
      ? validateDispatchRequest(rawArguments)
      : null;
    const runtime = resolveRuntime(env);

    if (name === "doctor") {
      exactObject(rawArguments, []);
      const plugin = inspectOfficialCompanion({ configDir: runtime.configDir });
      return textResult({
        product: "Claude GPT Orchestrator (CGO)",
        version: "0.2.0",
        node: process.version,
        projectDir: runtime.projectDir,
        pluginData: runtime.pluginData,
        requestedModel: REQUIRED_MODEL,
        modelCallPerformed: false,
        officialCodexPlugin: plugin
      });
    }

    if (name === "dispatch") {
      const plugin = inspectOfficialCompanion({ configDir: runtime.configDir });
      if (!plugin.ok || !plugin.compatible) throw new Error(plugin.message);
      const companion = resolveOfficialCompanion({ configDir: runtime.configDir });
      const invocation = buildTaskInvocation({
        request: dispatchRequest,
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
      const jobId = validateJobId(output.payload.jobId);
      return textResult({
        operation: "dispatch",
        routerContract: dispatchRequest.routerContract,
        classifierProvenance: CLASSIFIER_PROVENANCE,
        confidenceProvenance: CONFIDENCE_PROVENANCE,
        decisionState: dispatchRequest.decisionState,
        writeIntent: dispatchRequest.writeIntent,
        workflowId: dispatchRequest.workflowId,
        sequenceIndex: dispatchRequest.sequenceIndex,
        sequenceTotal: dispatchRequest.sequenceTotal,
        role: invocation.contract.role,
        requestedModel: invocation.contract.model,
        effort: invocation.contract.effort,
        mutationPolicy: invocation.contract.write ? "workspace-write" : "read-only",
        threadMode: "fresh",
        execution: "background",
        effectiveIdentity: "UNKNOWN_UNTIL_INSTRUMENTED",
        taskReceipt: {
          jobId,
          status: output.payload.status,
          title: output.payload.title,
          logFile: output.payload.logFile
        },
        officialStatus: output.payload.status,
        jobId,
        codexThreadId: null,
        stderrPresent: Boolean(output.stderr),
        observedJobIds: output.jobIds,
        correlation: "OFFICIAL_QUEUED_JOB_ID"
      });
    }

    if (name === "status") {
      const plugin = inspectOfficialCompanion({ configDir: runtime.configDir });
      if (!plugin.ok || !plugin.compatible) throw new Error(plugin.message);
      const companion = resolveOfficialCompanion({ configDir: runtime.configDir });
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
        }),
        args.job_id ?? null
      ));
    }

    if (name === "result") {
      const plugin = inspectOfficialCompanion({ configDir: runtime.configDir });
      if (!plugin.ok || !plugin.compatible) throw new Error(plugin.message);
      const companion = resolveOfficialCompanion({ configDir: runtime.configDir });
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
        }),
        args.job_id
      ));
    }

    throw new Error(`Unknown CGO tool: ${name}.`);
  } catch (error) {
    return textResult({
      ...(error?.code ? { code: error.code } : {}),
      error: error.message
    }, true);
  }
}
