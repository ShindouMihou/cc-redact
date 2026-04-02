import { test, expect, describe } from "bun:test";
import { redactEnv } from "../redactors/env.ts";

function stripNotice(output: string): string {
  const lines = output.split("\n");
  const firstNonNotice = lines.findIndex(
    (line) => !line.startsWith("# [cc-redact]") && !line.startsWith("# The keys"),
  );
  return lines.slice(firstNonNotice).join("\n");
}

describe("redactEnv", () => {
  test("includes redaction notice", () => {
    const result = redactEnv("KEY=value");
    expect(result).toContain("[cc-redact]");
    expect(result).toContain("referenced for typings");
  });

  test("redacts simple key=value", () => {
    expect(stripNotice(redactEnv("DATABASE_URL=postgres://localhost/db"))).toBe(
      "DATABASE_URL={{REDACTED}}",
    );
  });

  test("redacts multiple lines", () => {
    const input = `API_KEY=sk-123456
SECRET=mysecret
PORT=3000`;
    const expected = `API_KEY={{REDACTED}}
SECRET={{REDACTED}}
PORT={{REDACTED}}`;
    expect(stripNotice(redactEnv(input))).toBe(expected);
  });

  test("handles export prefix", () => {
    expect(stripNotice(redactEnv("export API_KEY=sk-123456"))).toBe(
      "export API_KEY={{REDACTED}}",
    );
  });

  test("preserves comments", () => {
    const input = `# Database config
DATABASE_URL=postgres://localhost/db
# API keys
API_KEY=sk-123`;
    const expected = `# Database config
DATABASE_URL={{REDACTED}}
# API keys
API_KEY={{REDACTED}}`;
    expect(stripNotice(redactEnv(input))).toBe(expected);
  });

  test("preserves empty lines", () => {
    const input = `KEY1=value1

KEY2=value2`;
    const expected = `KEY1={{REDACTED}}

KEY2={{REDACTED}}`;
    expect(stripNotice(redactEnv(input))).toBe(expected);
  });

  test("handles double-quoted values", () => {
    expect(stripNotice(redactEnv('KEY="some value with spaces"'))).toBe(
      "KEY={{REDACTED}}",
    );
  });

  test("handles single-quoted values", () => {
    expect(stripNotice(redactEnv("KEY='some value'"))).toBe("KEY={{REDACTED}}");
  });

  test("handles multiline quoted values", () => {
    const input = `KEY="line1
line2
line3"
NEXT_KEY=value`;
    const expected = `KEY={{REDACTED}}
NEXT_KEY={{REDACTED}}`;
    expect(stripNotice(redactEnv(input))).toBe(expected);
  });

  test("handles empty values", () => {
    expect(stripNotice(redactEnv("KEY="))).toBe("KEY={{REDACTED}}");
  });

  test("preserves indentation on export", () => {
    expect(stripNotice(redactEnv("  export KEY=value"))).toBe("  export KEY={{REDACTED}}");
  });

  test("handles dotted keys", () => {
    expect(stripNotice(redactEnv("app.secret.key=value123"))).toBe(
      "app.secret.key={{REDACTED}}",
    );
  });

  test("passes through unrecognized lines", () => {
    expect(stripNotice(redactEnv("this is not a valid env line"))).toBe(
      "this is not a valid env line",
    );
  });
});
