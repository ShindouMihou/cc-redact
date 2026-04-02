import { test, expect, describe } from "bun:test";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CWD = resolve(import.meta.dir, "../..");
const CC_REDACT_TEMP_DIR = join(tmpdir(), "cc-redact");

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
  test("deletes temp file in cc-redact temp dir", async () => {
    const tempPath = join(CC_REDACT_TEMP_DIR, `cleanup-test-${Date.now()}.env`);
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

  test("ignores files outside cc-redact temp dir", async () => {
    const tempPath = join(tmpdir(), `cleanup-test-${Date.now()}.txt`);
    await Bun.write(Bun.file(tempPath), "data", { createPath: true });

    const proc = runCleanup({ file_path: tempPath });
    await proc.exited;

    const existsAfter = await Bun.file(tempPath).exists();
    expect(existsAfter).toBe(true);

    const { unlink } = await import("node:fs/promises");
    await unlink(tempPath);
  });

  test("blocks path traversal attempts", async () => {
    const outsidePath = join(tmpdir(), `traversal-test-${Date.now()}.txt`);
    await Bun.write(Bun.file(outsidePath), "sensitive data", { createPath: true });

    const traversalPath = `${CC_REDACT_TEMP_DIR}/../../${outsidePath.split("/").pop()}`;
    const proc = runCleanup({ file_path: traversalPath });
    await proc.exited;

    const existsAfter = await Bun.file(outsidePath).exists();
    expect(existsAfter).toBe(true);

    const { unlink } = await import("node:fs/promises");
    await unlink(outsidePath);
  });

  test("exits 0 for nonexistent temp file", async () => {
    const proc = runCleanup({
      file_path: join(CC_REDACT_TEMP_DIR, "nonexistent.env"),
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
