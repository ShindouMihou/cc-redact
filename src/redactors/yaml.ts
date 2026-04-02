import { parseDocument, visit, isScalar, type Scalar } from "yaml";
import type { Redactor } from "../types.ts";

function redactScalar(node: Scalar): void {
  const val = node.value;
  if (typeof val === "string") {
    node.value = "{{REDACTED}}";
  } else if (typeof val === "number") {
    node.value = 0;
  } else if (typeof val === "boolean") {
    node.value = false;
  } else if (val instanceof Date) {
    node.value = "{{REDACTED}}";
  }
}

export const redactYaml: Redactor = (content) => {
  const doc = parseDocument(content);

  visit(doc, {
    Pair(_key, node) {
      if (isScalar(node.value)) {
        redactScalar(node.value);
      }
    },
    Seq(_key, node) {
      for (const item of node.items) {
        if (isScalar(item)) {
          redactScalar(item);
        }
      }
    },
  });

  const notice =
    "# [cc-redact] This file has been redacted for security. All values are replaced with type-safe placeholders.\n" +
    "# The keys and structure are accurate and can be referenced for typings.\n";
  return notice + doc.toString();
};
