import { test, expect, describe } from "bun:test";

const CWD = "/Volumes/Krnzy/Programming/claude-hooks";
const TMP_BASE = `/tmp/cc-redact-integration-${Date.now()}`;

function runHook(toolInput: Record<string, unknown>, cwd?: string) {
  const input = {
    session_id: "test",
    cwd: cwd ?? TMP_BASE,
    hook_event_name: "PreToolUse",
    tool_name: "Read",
    tool_input: toolInput,
  };

  return Bun.spawn(["bun", "src/main.ts"], {
    cwd: CWD,
    stdin: new Blob([JSON.stringify(input)]),
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("integration: env redaction", () => {
  test("redacts .env file matched by .redactcc", async () => {
    const dir = `${TMP_BASE}/env-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      ".env\n.env.*",
      { createPath: true },
    );
    await Bun.write(
      Bun.file(`${dir}/.env`),
      "API_KEY=sk-secret\nDATABASE_URL=postgres://user:pass@host/db\n",
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/.env` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    const tempPath = parsed.hookSpecificOutput.updatedInput.file_path;

    const redacted = await Bun.file(tempPath).text();
    expect(redacted).toContain("API_KEY={{REDACTED}}");
    expect(redacted).toContain("DATABASE_URL={{REDACTED}}");
    expect(redacted).not.toContain("sk-secret");
    expect(redacted).not.toContain("postgres://");
  });
});

describe("integration: json redaction", () => {
  test("redacts JSON file matched by .redactcc", async () => {
    const dir = `${TMP_BASE}/json-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      "secrets.json",
      { createPath: true },
    );
    await Bun.write(
      Bun.file(`${dir}/secrets.json`),
      JSON.stringify({ api_key: "sk-123", port: 5432, ssl: true }),
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/secrets.json` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    const tempPath = parsed.hookSpecificOutput.updatedInput.file_path;

    const rawRedacted = await Bun.file(tempPath).text();
    const jsonContent = rawRedacted
      .split("\n")
      .filter((line) => !line.startsWith("//"))
      .join("\n");
    const redacted = JSON.parse(jsonContent);
    expect(redacted.api_key).toBe("{{REDACTED}}");
    expect(redacted.port).toBe(0);
    expect(redacted.ssl).toBe(false);
  });
});

describe("integration: yaml redaction", () => {
  test("redacts YAML file matched by .redactcc", async () => {
    const dir = `${TMP_BASE}/yaml-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      "*.yaml",
      { createPath: true },
    );
    await Bun.write(
      Bun.file(`${dir}/config.yaml`),
      "host: db.internal\nport: 5432\nssl: true\n",
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/config.yaml` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    const tempPath = parsed.hookSpecificOutput.updatedInput.file_path;

    const redacted = await Bun.file(tempPath).text();
    expect(redacted).toContain("{{REDACTED}}");
    expect(redacted).not.toContain("db.internal");
  });
});

describe("integration: toml redaction", () => {
  test("redacts TOML file matched by .redactcc", async () => {
    const dir = `${TMP_BASE}/toml-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      "*.toml",
      { createPath: true },
    );
    await Bun.write(
      Bun.file(`${dir}/config.toml`),
      'host = "db.internal"\nport = 5432\n',
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/config.toml` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    const tempPath = parsed.hookSpecificOutput.updatedInput.file_path;

    const redacted = await Bun.file(tempPath).text();
    expect(redacted).toContain("{{REDACTED}}");
    expect(redacted).not.toContain("db.internal");
  });
});

describe("integration: opaque file blocking", () => {
  test("denies read for unrecognized format", async () => {
    const dir = `${TMP_BASE}/opaque-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      "*.pem",
      { createPath: true },
    );
    await Bun.write(
      Bun.file(`${dir}/cert.pem`),
      "-----BEGIN CERTIFICATE-----\nMIIBxTCCAW...",
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/cert.pem` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain(
      "unrecognized format",
    );
  });
});

describe("integration: pass-through", () => {
  test("passes through files not in .redactcc", async () => {
    const dir = `${TMP_BASE}/pass-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      ".env",
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/src/index.ts` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output.trim()).toBe("");
  });

  test("passes through when file does not exist", async () => {
    const dir = `${TMP_BASE}/missing-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      ".env",
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/.env` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output.trim()).toBe("");
  });
});

describe("integration: backward compatibility", () => {
  test("redacts .env files when no .redactcc exists", async () => {
    const dir = `${TMP_BASE}/compat-test`;
    await Bun.write(
      Bun.file(`${dir}/.env`),
      "SECRET=top-secret-value\n",
      { createPath: true },
    );

    const proc = runHook({ file_path: `${dir}/.env` }, dir);
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    const tempPath = parsed.hookSpecificOutput.updatedInput.file_path;

    const redacted = await Bun.file(tempPath).text();
    expect(redacted).toContain("SECRET={{REDACTED}}");
    expect(redacted).not.toContain("top-secret-value");
  });
});

describe("integration: preserves tool_input fields", () => {
  test("forwards limit and offset in updatedInput", async () => {
    const dir = `${TMP_BASE}/fields-test`;
    await Bun.write(
      Bun.file(`${dir}/.redactcc`),
      ".env",
      { createPath: true },
    );
    await Bun.write(
      Bun.file(`${dir}/.env`),
      "KEY=value\n",
      { createPath: true },
    );

    const proc = runHook(
      { file_path: `${dir}/.env`, limit: 100, offset: 5 },
      dir,
    );
    const output = await new Response(proc.stdout).text();

    const parsed = JSON.parse(output);
    expect(parsed.hookSpecificOutput.updatedInput.limit).toBe(100);
    expect(parsed.hookSpecificOutput.updatedInput.offset).toBe(5);
  });
});
