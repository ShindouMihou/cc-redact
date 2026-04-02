import { test, expect, describe } from "bun:test";

const CWD = "/Volumes/Krnzy/Programming/claude-hooks";

function runCleanup(toolInput: Record<string, unknown>) {
  const input = {
    session_id: "test",
    cwd: "/tmp",
    hook_event_name: "PostToolUse",
    tool_name: "Read",
    tool_input: toolInput,
  };

  return Bun.spawn(["bun", "src/main.ts", "--cleanup"], {
    cwd: CWD,
    stdin: new Blob([JSON.stringify(input)]),
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("cleanup", () => {
  test("deletes temp file in /tmp/cc-redact/", async () => {
    const tempPath = `/tmp/cc-redact/cleanup-test-${Date.now()}.env`;
    await Bun.write(Bun.file(tempPath), "KEY={{REDACTED}}", {
      createPath: true,
    });

    const exists = await Bun.file(tempPath).exists();
    expect(exists).toBe(true);

    const proc = runCleanup({ file_path: tempPath });
    await proc.exited;

    const existsAfter = await Bun.file(tempPath).exists();
    expect(existsAfter).toBe(false);
  });

  test("ignores files outside /tmp/cc-redact/", async () => {
    const tempPath = `/tmp/cleanup-test-${Date.now()}.txt`;
    await Bun.write(Bun.file(tempPath), "data", { createPath: true });

    const proc = runCleanup({ file_path: tempPath });
    await proc.exited;

    const existsAfter = await Bun.file(tempPath).exists();
    expect(existsAfter).toBe(true);

    const { unlink } = await import("node:fs/promises");
    await unlink(tempPath);
  });

  test("exits 0 for nonexistent temp file", async () => {
    const proc = runCleanup({
      file_path: "/tmp/cc-redact/nonexistent.env",
    });
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });

  test("exits 0 for invalid input", async () => {
    const proc = Bun.spawn(["bun", "src/main.ts", "--cleanup"], {
      cwd: CWD,
      stdin: new Blob(["not json"]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
  });
});
