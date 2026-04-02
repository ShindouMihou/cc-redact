import { test, expect, describe } from "bun:test";
import {
  parseRedactConfig,
  loadRedactConfig,
  fileMatchesPatterns,
  expandPatterns,
} from "../config.ts";

describe("parseRedactConfig", () => {
  test("parses glob patterns", () => {
    const config = parseRedactConfig(".env\n.env.*\nconfig/secrets.json");
    expect(config.patterns).toEqual([".env", ".env.*", "config/secrets.json"]);
  });

  test("ignores comments and empty lines", () => {
    const config = parseRedactConfig(
      "# comment\n\n.env\n  # indented comment\n\n.env.*",
    );
    expect(config.patterns).toEqual([".env", ".env.*"]);
  });

  test("trims whitespace", () => {
    const config = parseRedactConfig("  .env  \n  .env.*  ");
    expect(config.patterns).toEqual([".env", ".env.*"]);
  });

  test("returns empty patterns for empty content", () => {
    const config = parseRedactConfig("");
    expect(config.patterns).toEqual([]);
  });
});

describe("loadRedactConfig", () => {
  test("returns default patterns when no .redactcc exists", async () => {
    const config = await loadRedactConfig("/nonexistent/path");
    expect(config.patterns).toEqual([".env", ".env.*"]);
  });

  test("reads .redactcc from project root", async () => {
    const tmpDir = `/tmp/cc-redact-test-config-${Date.now()}`;
    await Bun.write(
      Bun.file(`${tmpDir}/.redactcc`),
      "secrets.json\n*.key",
      { createPath: true },
    );

    const config = await loadRedactConfig(tmpDir);
    expect(config.patterns).toEqual(["secrets.json", "*.key"]);
  });
});

describe("fileMatchesPatterns", () => {
  const root = "/project";

  test("matches exact filename", () => {
    expect(fileMatchesPatterns("/project/.env", root, [".env"])).toBe(true);
  });

  test("matches wildcard pattern", () => {
    expect(fileMatchesPatterns("/project/.env.local", root, [".env.*"])).toBe(
      true,
    );
    expect(
      fileMatchesPatterns("/project/.env.production", root, [".env.*"]),
    ).toBe(true);
  });

  test("matches nested path with double-star", () => {
    expect(
      fileMatchesPatterns("/project/config/secrets.json", root, [
        "**/secrets.json",
      ]),
    ).toBe(true);
  });

  test("rejects non-matching files", () => {
    expect(
      fileMatchesPatterns("/project/src/index.ts", root, [".env", ".env.*"]),
    ).toBe(false);
  });

  test("rejects files outside project root", () => {
    expect(fileMatchesPatterns("/other/project/.env", root, [".env"])).toBe(
      false,
    );
  });

  test("matches glob with extension wildcard", () => {
    expect(fileMatchesPatterns("/project/cert.pem", root, ["*.pem"])).toBe(
      true,
    );
  });

  test("auto-matches .yml when .yaml pattern is specified", () => {
    expect(
      fileMatchesPatterns("/project/config.yml", root, ["*.yaml"]),
    ).toBe(true);
  });

  test("auto-matches .yaml when .yml pattern is specified", () => {
    expect(
      fileMatchesPatterns("/project/config.yaml", root, ["*.yml"]),
    ).toBe(true);
  });

  test("auto-matches nested yaml/yml aliases", () => {
    expect(
      fileMatchesPatterns("/project/config/secrets.yml", root, [
        "**/secrets.yaml",
      ]),
    ).toBe(true);
  });
});

describe("expandPatterns", () => {
  test("expands .yaml to include .yml", () => {
    expect(expandPatterns(["*.yaml"])).toEqual(["*.yaml", "*.yml"]);
  });

  test("expands .yml to include .yaml", () => {
    expect(expandPatterns(["*.yml"])).toEqual(["*.yml", "*.yaml"]);
  });

  test("does not expand non-aliased extensions", () => {
    expect(expandPatterns(["*.json"])).toEqual(["*.json"]);
  });

  test("expands multiple patterns independently", () => {
    expect(expandPatterns(["*.yaml", "*.json"])).toEqual([
      "*.yaml",
      "*.yml",
      "*.json",
    ]);
  });
});
