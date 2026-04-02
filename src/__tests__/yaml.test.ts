import { test, expect, describe } from "bun:test";
import { redactYaml } from "../redactors/yaml.ts";
import { parse } from "yaml";

describe("redactYaml", () => {
  test("includes redaction notice", () => {
    const result = redactYaml("key: value");
    expect(result).toContain("[cc-redact]");
    expect(result).toContain("referenced for typings");
  });

  test("redacts string values", () => {
    const input = `host: db.prod.internal
password: secret123`;
    const result = parse(redactYaml(input));
    expect(result.host).toBe("{{REDACTED}}");
    expect(result.password).toBe("{{REDACTED}}");
  });

  test("replaces numbers with 0", () => {
    const input = `port: 5432
timeout: 30000`;
    const result = parse(redactYaml(input));
    expect(result.port).toBe(0);
    expect(result.timeout).toBe(0);
  });

  test("replaces booleans with false", () => {
    const input = `ssl: true
debug: false`;
    const result = parse(redactYaml(input));
    expect(result.ssl).toBe(false);
    expect(result.debug).toBe(false);
  });

  test("preserves null", () => {
    const input = `optional: null`;
    const result = parse(redactYaml(input));
    expect(result.optional).toBeNull();
  });

  test("preserves nested structure", () => {
    const input = `database:
  host: localhost
  credentials:
    username: admin
    password: secret`;
    const result = parse(redactYaml(input));
    expect(result.database.host).toBe("{{REDACTED}}");
    expect(result.database.credentials.username).toBe("{{REDACTED}}");
    expect(result.database.credentials.password).toBe("{{REDACTED}}");
  });

  test("preserves array structure", () => {
    const input = `tags:
  - prod
  - us-east`;
    const result = parse(redactYaml(input));
    expect(result.tags).toEqual(["{{REDACTED}}", "{{REDACTED}}"]);
  });

  test("preserves comments", () => {
    const input = `# Database configuration
host: localhost # the host
port: 5432`;
    const output = redactYaml(input);
    expect(output).toContain("# Database configuration");
    expect(output).toContain("# the host");
  });

  test("handles multiline strings", () => {
    const input = `description: |
  This is a long
  multiline description`;
    const result = parse(redactYaml(input));
    expect(result.description).toBe("{{REDACTED}}");
  });
});
