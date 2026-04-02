import { test, expect, describe } from "bun:test";
import { detectFormat } from "../format.ts";

describe("detectFormat", () => {
  test("detects .env files", () => {
    expect(detectFormat("/project/.env")).toEqual({
      kind: "redactable",
      format: "env",
    });
    expect(detectFormat("/project/.env.local")).toEqual({
      kind: "redactable",
      format: "env",
    });
    expect(detectFormat("/project/.env.production")).toEqual({
      kind: "redactable",
      format: "env",
    });
    expect(detectFormat(".env")).toEqual({
      kind: "redactable",
      format: "env",
    });
  });

  test("detects JSON files", () => {
    expect(detectFormat("/project/secrets.json")).toEqual({
      kind: "redactable",
      format: "json",
    });
    expect(detectFormat("/project/config.jsonc")).toEqual({
      kind: "redactable",
      format: "json",
    });
  });

  test("detects YAML files", () => {
    expect(detectFormat("/project/config.yaml")).toEqual({
      kind: "redactable",
      format: "yaml",
    });
    expect(detectFormat("/project/config.yml")).toEqual({
      kind: "redactable",
      format: "yaml",
    });
  });

  test("detects TOML files", () => {
    expect(detectFormat("/project/config.toml")).toEqual({
      kind: "redactable",
      format: "toml",
    });
  });

  test("returns opaque for unrecognized extensions", () => {
    expect(detectFormat("/project/cert.pem")).toEqual({ kind: "opaque" });
    expect(detectFormat("/project/key.key")).toEqual({ kind: "opaque" });
    expect(detectFormat("/project/data.bin")).toEqual({ kind: "opaque" });
    expect(detectFormat("/project/readme.txt")).toEqual({ kind: "opaque" });
  });

  test("is case-insensitive for extensions", () => {
    expect(detectFormat("/project/config.JSON")).toEqual({
      kind: "redactable",
      format: "json",
    });
    expect(detectFormat("/project/config.YAML")).toEqual({
      kind: "redactable",
      format: "yaml",
    });
  });
});
