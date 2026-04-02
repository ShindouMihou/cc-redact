#!/usr/bin/env node

// src/redact.ts
import { createHash } from "crypto";
import { existsSync as existsSync2, mkdirSync, writeFileSync } from "fs";
import { readFile as readFile2 } from "fs/promises";
import { extname as extname2, dirname } from "path";

// src/config.ts
import picomatch from "picomatch";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { relative, isAbsolute } from "path";
var DEFAULT_PATTERNS = [".env", ".env.*"];
function parseRedactConfig(content) {
  const patterns = content.split("\n").map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#"));
  return { patterns };
}
async function loadRedactConfig(projectRoot) {
  const configPath = `${projectRoot}/.redactcc`;
  if (!existsSync(configPath)) {
    return { patterns: DEFAULT_PATTERNS };
  }
  const content = await readFile(configPath, "utf-8");
  return parseRedactConfig(content);
}
var EXTENSION_ALIASES = {
  ".yaml": ".yml",
  ".yml": ".yaml"
};
function expandPatterns(patterns) {
  const expanded = [];
  for (const pattern of patterns) {
    expanded.push(pattern);
    for (const [ext, alias] of Object.entries(EXTENSION_ALIASES)) {
      if (pattern.endsWith(ext)) {
        expanded.push(pattern.slice(0, -ext.length) + alias);
      }
    }
  }
  return expanded;
}
function fileMatchesPatterns(filePath, projectRoot, patterns) {
  const rel = isAbsolute(filePath) ? relative(projectRoot, filePath) : filePath;
  if (rel.startsWith("..")) return false;
  const allPatterns = expandPatterns(patterns);
  return allPatterns.some((pattern) => picomatch(pattern)(rel));
}

// src/format.ts
import { extname, basename } from "path";
var ENV_BASENAME_PATTERN = /^\.env(?:\..+)?$/;
function detectFormat(filePath) {
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

// src/redactors/env.ts
var redactEnv = (content) => {
  const lines = content.split("\n");
  const result = [];
  let inMultilineValue = false;
  let closingQuote = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
    const prefix = match[1];
    const key = match[2];
    const rawValue = match[3];
    const trimmedValue = rawValue.trimStart();
    const quoteChar = trimmedValue.startsWith('"') ? '"' : trimmedValue.startsWith("'") ? "'" : null;
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
  const notice = "# [cc-redact] This file has been redacted for security. All values are replaced with {{REDACTED}}.\n# The keys and structure are accurate and can be referenced for typings.\n";
  return notice + result.join("\n");
};

// src/redactors/json.ts
function redactValue(value) {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = redactValue(v);
    }
    return result;
  }
  if (typeof value === "string") return "{{REDACTED}}";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return value;
}
function stripJsonComments(content) {
  let result = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
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
var redactJson = (content) => {
  const stripped = stripJsonComments(content);
  const parsed = JSON.parse(stripped);
  const redacted = redactValue(parsed);
  const notice = "// [cc-redact] This file has been redacted for security. All values are replaced with type-safe placeholders.\n// The keys and structure are accurate and can be referenced for typings.\n";
  return notice + JSON.stringify(redacted, null, 2);
};

// src/redactors/yaml.ts
import { parseDocument, visit, isScalar } from "yaml";
function redactScalar(node) {
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
var redactYaml = (content) => {
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
    }
  });
  const notice = "# [cc-redact] This file has been redacted for security. All values are replaced with type-safe placeholders.\n# The keys and structure are accurate and can be referenced for typings.\n";
  return notice + doc.toString();
};

// src/redactors/toml.ts
import { parse, stringify } from "smol-toml";
function redactValue2(value) {
  if (value === null || value === void 0) return value;
  if (value instanceof Date) return /* @__PURE__ */ new Date(0);
  if (Array.isArray(value)) return value.map(redactValue2);
  if (typeof value === "object") {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = redactValue2(v);
    }
    return result;
  }
  if (typeof value === "string") return "{{REDACTED}}";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  return value;
}
var redactToml = (content) => {
  const parsed = parse(content);
  const redacted = redactValue2(parsed);
  const notice = "# [cc-redact] This file has been redacted for security. All values are replaced with type-safe placeholders.\n# The keys and structure are accurate and can be referenced for typings.\n";
  return notice + stringify(redacted);
};

// src/redactors/index.ts
var redactors = {
  env: redactEnv,
  json: redactJson,
  yaml: redactYaml,
  toml: redactToml
};

// src/redact.ts
function getRedactedTempPath(originalPath) {
  const hash = createHash("sha256").update(originalPath).digest("hex").slice(0, 16);
  const ext = extname2(originalPath) || ".env";
  return `/tmp/cc-redact/${hash}${ext}`;
}
async function processReadRequest(input) {
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
      reason: `File "${filePath}" matches a .redactcc pattern but has an unrecognized format. Read blocked to protect potentially sensitive content.`
    };
  }
  if (!existsSync2(filePath)) {
    return { kind: "pass" };
  }
  const content = await readFile2(filePath, "utf-8");
  const redactor = redactors[detection.format];
  const redacted = redactor(content);
  const tempPath = getRedactedTempPath(filePath);
  const tempDir = dirname(tempPath);
  if (!existsSync2(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }
  writeFileSync(tempPath, redacted, "utf-8");
  return { kind: "redirect", tempPath };
}

// src/main.ts
import { existsSync as existsSync3, unlinkSync } from "fs";
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => data += chunk);
    process.stdin.on("end", () => resolve(data));
  });
}
var isCleanup = process.argv.includes("--cleanup");
try {
  const raw = await readStdin();
  const input = JSON.parse(raw);
  if (isCleanup) {
    const filePath = input.tool_input.file_path;
    if (filePath.startsWith("/tmp/cc-redact/") && existsSync3(filePath)) {
      unlinkSync(filePath);
    }
    process.exit(0);
  }
  const result = await processReadRequest(input);
  if (result.kind === "pass") {
    process.exit(0);
  }
  if (result.kind === "deny") {
    const output2 = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: result.reason
      }
    };
    console.log(JSON.stringify(output2));
    process.exit(0);
  }
  const updatedInput = {
    file_path: result.tempPath
  };
  if (input.tool_input.limit !== void 0)
    updatedInput.limit = input.tool_input.limit;
  if (input.tool_input.offset !== void 0)
    updatedInput.offset = input.tool_input.offset;
  if (input.tool_input.pages !== void 0)
    updatedInput.pages = input.tool_input.pages;
  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput
    }
  };
  console.log(JSON.stringify(output));
} catch {
  process.exit(0);
}
