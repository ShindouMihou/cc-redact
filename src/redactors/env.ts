import type { Redactor } from "../types.ts";

export const redactEnv: Redactor = (content) => {
  const lines = content.split("\n");
  const result: string[] = [];
  let inMultilineValue = false;
  let closingQuote = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (inMultilineValue) {
      if (line.includes(closingQuote)) {
        inMultilineValue = false;
        closingQuote = "";
      }
      continue;
    }

    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      result.push(line);
      continue;
    }

    const match = line.match(/^(\s*(?:export\s+)?)([\w.]+)\s*=(.*)/);
    if (!match) {
      result.push(line);
      continue;
    }

    const prefix = match[1]!;
    const key = match[2]!;
    const rawValue = match[3]!;

    const trimmedValue = rawValue.trimStart();
    const quoteChar =
      trimmedValue.startsWith('"')
        ? '"'
        : trimmedValue.startsWith("'")
          ? "'"
          : null;

    if (quoteChar) {
      const afterOpenQuote = trimmedValue.slice(1);
      const closeIndex = afterOpenQuote.indexOf(quoteChar);
      if (closeIndex === -1) {
        inMultilineValue = true;
        closingQuote = quoteChar;
        result.push(`${prefix}${key}={{REDACTED}}`);
        continue;
      }
    }

    result.push(`${prefix}${key}={{REDACTED}}`);
  }

  const notice =
    "# [cc-redact] This file has been redacted for security. All values are replaced with {{REDACTED}}.\n" +
    "# The keys and structure are accurate and can be referenced for typings.\n";
  return notice + result.join("\n");
};
