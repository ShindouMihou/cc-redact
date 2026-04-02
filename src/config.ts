import picomatch from "picomatch";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { relative, isAbsolute } from "node:path";

export interface RedactConfig {
  patterns: string[];
}

const DEFAULT_PATTERNS = [".env", ".env.*"];

export function parseRedactConfig(content: string): RedactConfig {
  const patterns = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  return { patterns };
}

export async function loadRedactConfig(
  projectRoot: string,
): Promise<RedactConfig> {
  const configPath = `${projectRoot}/.redactcc`;
  if (!existsSync(configPath)) {
    return { patterns: DEFAULT_PATTERNS };
  }
  const content = await readFile(configPath, "utf-8");
  return parseRedactConfig(content);
}

const EXTENSION_ALIASES: Record<string, string> = {
  ".yaml": ".yml",
  ".yml": ".yaml",
};

export function expandPatterns(patterns: string[]): string[] {
  const expanded: string[] = [];
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

export function fileMatchesPatterns(
  filePath: string,
  projectRoot: string,
  patterns: string[],
): boolean {
  const rel = isAbsolute(filePath)
    ? relative(projectRoot, filePath)
    : filePath;

  if (rel.startsWith("..")) return false;

  const allPatterns = expandPatterns(patterns);
  return allPatterns.some((pattern) => picomatch(pattern)(rel));
}
