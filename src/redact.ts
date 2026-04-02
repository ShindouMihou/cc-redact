import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, dirname } from "node:path";
import { loadRedactConfig, fileMatchesPatterns } from "./config.ts";
import { detectFormat } from "./format.ts";
import { redactors } from "./redactors/index.ts";
import type { HookInput } from "./types.ts";

interface RedactRedirect {
  kind: "redirect";
  tempPath: string;
}

interface RedactDeny {
  kind: "deny";
  reason: string;
}

interface RedactPassThrough {
  kind: "pass";
}

export type RedactResult = RedactRedirect | RedactDeny | RedactPassThrough;

export function getRedactedTempPath(originalPath: string): string {
  const hash = createHash("sha256").update(originalPath).digest("hex").slice(0, 16);
  const ext = extname(originalPath) || ".env";
  return `/tmp/cc-redact/${hash}${ext}`;
}

export async function processReadRequest(
  input: HookInput,
): Promise<RedactResult> {
  const filePath = input.tool_input.file_path;
  const cwd = input.cwd ?? process.cwd();

  const config = await loadRedactConfig(cwd);
  if (!fileMatchesPatterns(filePath, cwd, config.patterns)) {
    return { kind: "pass" };
  }

  const detection = detectFormat(filePath);

  if (detection.kind === "opaque") {
    return {
      kind: "deny",
      reason: `File "${filePath}" matches a .redactcc pattern but has an unrecognized format. Read blocked to protect potentially sensitive content.`,
    };
  }

  if (!existsSync(filePath)) {
    return { kind: "pass" };
  }

  const content = await readFile(filePath, "utf-8");
  const redactor = redactors[detection.format];
  const redacted = redactor(content);

  const tempPath = getRedactedTempPath(filePath);
  const tempDir = dirname(tempPath);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  writeFileSync(tempPath, redacted, "utf-8");

  return { kind: "redirect", tempPath };
}
