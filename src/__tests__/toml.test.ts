import { test, expect, describe } from "bun:test";
import { redactToml } from "../redactors/toml.ts";
import { parse } from "smol-toml";

describe("redactToml", () => {
  test("includes redaction notice", () => {
    const result = redactToml('key = "value"');
    expect(result).toContain("[cc-redact]");
    expect(result).toContain("referenced for typings");
  });

  test("redacts string values", () => {
    const input = `host = "db.prod.internal"
password = "secret123"`;
    const result = parse(redactToml(input));
    expect(result.host).toBe("{{REDACTED}}");
    expect(result.password).toBe("{{REDACTED}}");
  });

  test("replaces numbers with 0", () => {
    const input = `port = 5432
timeout = 30000`;
    const result = parse(redactToml(input));
    expect(result.port).toBe(0);
    expect(result.timeout).toBe(0);
  });

  test("replaces booleans with false", () => {
    const input = `ssl = true
debug = false`;
    const result = parse(redactToml(input));
    expect(result.ssl).toBe(false);
    expect(result.debug).toBe(false);
  });

  test("preserves table structure", () => {
    const input = `[database]
host = "localhost"

[database.credentials]
username = "admin"
password = "secret"`;
    const result = parse(redactToml(input));
    expect(result.database).toBeDefined();
    const db = result.database as Record<string, unknown>;
    expect(db.host).toBe("{{REDACTED}}");
    const creds = db.credentials as Record<string, unknown>;
    expect(creds.username).toBe("{{REDACTED}}");
    expect(creds.password).toBe("{{REDACTED}}");
  });

  test("preserves array structure", () => {
    const input = `tags = ["prod", "us-east"]
ports = [80, 443]`;
    const result = parse(redactToml(input));
    expect(result.tags).toEqual(["{{REDACTED}}", "{{REDACTED}}"]);
    expect(result.ports).toEqual([0, 0]);
  });

  test("handles inline tables", () => {
    const input = `server = { host = "localhost", port = 8080 }`;
    const result = parse(redactToml(input));
    const server = result.server as Record<string, unknown>;
    expect(server.host).toBe("{{REDACTED}}");
    expect(server.port).toBe(0);
  });

  test("handles array of tables", () => {
    const input = `[[servers]]
host = "alpha"
port = 8001

[[servers]]
host = "beta"
port = 8002`;
    const result = parse(redactToml(input));
    const servers = result.servers as Record<string, unknown>[];
    expect(servers).toHaveLength(2);
    expect(servers[0]!.host).toBe("{{REDACTED}}");
    expect(servers[0]!.port).toBe(0);
    expect(servers[1]!.host).toBe("{{REDACTED}}");
    expect(servers[1]!.port).toBe(0);
  });
});
