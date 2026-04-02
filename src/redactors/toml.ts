import { parse, stringify } from "smol-toml";
import type { Redactor } from "../types.ts";
import { redactValue } from "./shared.ts";

export const redactToml: Redactor = (content) => {
  const parsed = parse(content);
  const redacted = redactValue(parsed) as Record<string, unknown>;
  const notice =
    "# [cc-redact] This file has been redacted for security. All values are replaced with type-safe placeholders.\n" +
    "# The keys and structure are accurate and can be referenced for typings.\n";
  return notice + stringify(redacted);
};
