
## cc-redact

A Claude Code hook that redacts secrets from files before Claude reads them.

### Runtime

Source code must use **Node.js standard library only** — no Bun-specific APIs (`Bun.file`, `Bun.hash`, `Bun.stdin`, etc.). This ensures the built output runs with both `node` and `bun`.

Use `node:fs`, `node:crypto`, `node:path`, and `node:fs/promises` for file/system operations.

### Development

- Use `bun test` to run tests (tests may use Bun APIs since they're dev-only)
- Use `bun run build` to compile via tsup → `dist/main.js`
- Use `bun install` to install dependencies

### Testing

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

### Build

```sh
bun run build
```

Outputs `dist/main.js` — a single ESM bundle targeting Node 18+.
