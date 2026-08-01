#!/usr/bin/env node

import readline from "node:readline";
import process from "node:process";

import {
  TOOL_DEFINITIONS,
  callTool
} from "./tools.mjs";

function response(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id, code, message) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message }
  };
}

function handle(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return errorResponse(message?.id, -32600, "Invalid JSON-RPC request.");
  }

  if (message.method.startsWith("notifications/")) return null;

  if (message.method === "initialize") {
    return response(message.id, {
      protocolVersion: message.params?.protocolVersion || "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "cgo",
        title: "Claude GPT Orchestrator (CGO)",
        version: "0.2.0"
      },
      instructions: "Apply CGO_ROUTING_V2. Keep simple, ambiguous, and out-of-scope work in Claude; dispatch only validated clear specialist phases. Claude remains the planner and user-facing orchestrator."
    });
  }

  if (message.method === "ping") return response(message.id, {});

  if (message.method === "tools/list") {
    return response(message.id, { tools: TOOL_DEFINITIONS });
  }

  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (typeof name !== "string") {
      return errorResponse(message.id, -32602, "tools/call requires a tool name.");
    }
    return response(
      message.id,
      callTool(name, message.params?.arguments, process.env)
    );
  }

  return errorResponse(message.id, -32601, `Method not found: ${message.method}.`);
}

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

for await (const line of input) {
  if (!line.trim()) continue;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, "Parse error."))}\n`);
    continue;
  }
  const output = handle(message);
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
}
