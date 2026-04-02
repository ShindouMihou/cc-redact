#!/usr/bin/env node
import { processReadRequest } from "./redact.ts";
import type { HookInput } from "./types.ts";
import { existsSync, unlinkSync } from "node:fs";

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

const isCleanup = process.argv.includes("--cleanup");

try {
  const raw = await readStdin();
  const input: HookInput = JSON.parse(raw);

  if (isCleanup) {
    const filePath = input.tool_input.file_path;
    if (filePath.startsWith("/tmp/cc-redact/") && existsSync(filePath)) {
      unlinkSync(filePath);
    }
    process.exit(0);
  }

  const result = await processReadRequest(input);

  if (result.kind === "pass") {
    process.exit(0);
  }

  if (result.kind === "deny") {
    const output = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: result.reason,
      },
    };
    console.log(JSON.stringify(output));
    process.exit(0);
  }

  const updatedInput: Record<string, unknown> = {
    file_path: result.tempPath,
  };
  if (input.tool_input.limit !== undefined)
    updatedInput.limit = input.tool_input.limit;
  if (input.tool_input.offset !== undefined)
    updatedInput.offset = input.tool_input.offset;
  if (input.tool_input.pages !== undefined)
    updatedInput.pages = input.tool_input.pages;

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput,
    },
  };

  console.log(JSON.stringify(output));
} catch {
  process.exit(0);
}
