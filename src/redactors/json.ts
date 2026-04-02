import type { Redactor } from "../types.ts";

function redactValue(value: unknown): unknown {
  if (value === null) return null;
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

function stripJsonComments(content: string): string {
  let result = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;

    if (escape) {
      result += char;
      escape = false;
      continue;
    }

    if (inString) {
      if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      result += char;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === "/" && content[i + 1] === "/") {
      const newline = content.indexOf("\n", i);
      if (newline === -1) break;
      i = newline - 1;
      continue;
    }

    if (char === "/" && content[i + 1] === "*") {
      const end = content.indexOf("*/", i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }

    result += char;
  }

  return result;
}

export const redactJson: Redactor = (content) => {
  const stripped = stripJsonComments(content);
  const parsed = JSON.parse(stripped);
  const redacted = redactValue(parsed);
  const notice =
    "// [cc-redact] This file has been redacted for security. All values are replaced with type-safe placeholders.\n" +
    "// The keys and structure are accurate and can be referenced for typings.\n";
  return notice + JSON.stringify(redacted, null, 2);
};
