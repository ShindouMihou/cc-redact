import { extname, basename } from "node:path";
import type { FormatDetection } from "./types.ts";

const ENV_BASENAME_PATTERN = /^\.env(?:\..+)?$/;

export function detectFormat(filePath: string): FormatDetection {
  const base = basename(filePath);
  if (ENV_BASENAME_PATTERN.test(base)) {
    return { kind: "redactable", format: "env" };
  }

  const ext = extname(filePath).toLowerCase();

  switch (ext) {
    case ".json":
    case ".jsonc":
      return { kind: "redactable", format: "json" };
    case ".yaml":
    case ".yml":
      return { kind: "redactable", format: "yaml" };
    case ".toml":
      return { kind: "redactable", format: "toml" };
    default:
      return { kind: "opaque" };
  }
}
