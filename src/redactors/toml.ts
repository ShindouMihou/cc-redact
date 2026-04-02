import { parse, stringify } from "smol-toml";
import type { Redactor } from "../types.ts";

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(0);
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = redactValue(v);
    }
    return result;
  }
  if (typeof value === "string") return "{{REDACTED}}";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return value;
}

export const redactToml: Redactor = (content) => {
  const parsed = parse(content);
  const redacted = redactValue(parsed) as Record<string, unknown>;
  const notice =
    "# [cc-redact] This file has been redacted for security. All values are replaced with type-safe placeholders.\n" +
    "# The keys and structure are accurate and can be referenced for typings.\n";
  return notice + stringify(redacted);
};
