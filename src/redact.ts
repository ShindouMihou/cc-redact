import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
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

export const CC_REDACT_TEMP_DIR = join(tmpdir(), "cc-redact");

export function getRedactedTempPath(originalPath: string): string {
  const hash = createHash("sha256").update(originalPath).digest("hex").slice(0, 16);
  const ext = extname(originalPath) || ".env";
  return join(CC_REDACT_TEMP_DIR, `${hash}${ext}`);
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

  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      return { kind: "pass" };
    }
    throw err;
  }

  const redactor = redactors[detection.format];
  const redacted = redactor(content);

  const tempPath = getRedactedTempPath(filePath);
  await mkdir(CC_REDACT_TEMP_DIR, { recursive: true, mode: 0o700 });
  await writeFile(tempPath, redacted, { encoding: "utf-8", mode: 0o600 });

  return { kind: "redirect", tempPath };
}
