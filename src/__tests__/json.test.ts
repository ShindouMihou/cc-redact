import { test, expect, describe } from "bun:test";
import { redactJson } from "../redactors/json.ts";

function stripNotice(output: string): string {
  const lines = output.split("\n");
  const firstNonNotice = lines.findIndex(
    (line) => !line.startsWith("// [cc-redact]") && !line.startsWith("// The keys"),
  );
  return lines.slice(firstNonNotice).join("\n");
}

describe("redactJson", () => {
  test("includes redaction notice", () => {
    const result = redactJson(JSON.stringify({ key: "value" }));
    expect(result).toContain("[cc-redact]");
    expect(result).toContain("referenced for typings");
  });

  test("redacts string values", () => {
    const input = JSON.stringify({ host: "db.prod.internal", password: "secret" });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.host).toBe("{{REDACTED}}");
    expect(result.password).toBe("{{REDACTED}}");
  });

  test("replaces numbers with 0", () => {
    const input = JSON.stringify({ port: 5432, timeout: 30000 });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.port).toBe(0);
    expect(result.timeout).toBe(0);
  });

  test("replaces booleans with false", () => {
    const input = JSON.stringify({ ssl: true, debug: false });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.ssl).toBe(false);
    expect(result.debug).toBe(false);
  });

  test("preserves null", () => {
    const input = JSON.stringify({ optional: null });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.optional).toBeNull();
  });

  test("preserves nested object structure", () => {
    const input = JSON.stringify({
      database: {
        host: "localhost",
        credentials: { username: "admin", password: "secret" },
      },
    });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.database.host).toBe("{{REDACTED}}");
    expect(result.database.credentials.username).toBe("{{REDACTED}}");
    expect(result.database.credentials.password).toBe("{{REDACTED}}");
  });

  test("preserves array structure", () => {
    const input = JSON.stringify({ tags: ["prod", "us-east"], ports: [80, 443] });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.tags).toEqual(["{{REDACTED}}", "{{REDACTED}}"]);
    expect(result.ports).toEqual([0, 0]);
  });

  test("handles empty objects and arrays", () => {
    const input = JSON.stringify({ empty: {}, list: [] });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.empty).toEqual({});
    expect(result.list).toEqual([]);
  });

  test("handles mixed-type arrays", () => {
    const input = JSON.stringify({ mixed: ["string", 42, true, null] });
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.mixed).toEqual(["{{REDACTED}}", 0, false, null]);
  });

  test("strips JSONC line comments", () => {
    const input = `{
  // this is a comment
  "key": "value"
}`;
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.key).toBe("{{REDACTED}}");
  });

  test("strips JSONC block comments", () => {
    const input = `{
  /* block comment */
  "key": "value"
}`;
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.key).toBe("{{REDACTED}}");
  });

  test("does not strip comment-like content inside strings", () => {
    const input = `{"url": "http://example.com//path"}`;
    const result = JSON.parse(stripNotice(redactJson(input)));
    expect(result.url).toBe("{{REDACTED}}");
  });

  test("outputs pretty-printed JSON", () => {
    const input = JSON.stringify({ a: "b" });
    const output = redactJson(input);
    expect(output).toContain("\n");
    expect(output).toContain("  ");
  });
});
