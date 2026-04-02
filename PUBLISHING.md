# Publishing cc-redact

## Prerequisites

- [Bun](https://bun.sh) installed
- An [npm](https://www.npmjs.com) account with publish access

## Pre-publish Checklist

1. Run the test suite:
   ```bash
   bun test
   ```

2. Verify the package contents (only `src/**/*.ts` excluding tests should be included):
   ```bash
   npm pack --dry-run
   ```

3. Ensure `package.json` has the correct version:
   ```bash
   bun run --eval "console.log(require('./package.json').version)"
   ```

4. Remove `"private": true` from `package.json` if present.

## Publishing

### First-time Setup

```bash
npm login
```

### Publish a New Version

1. Bump the version:
   ```bash
   npm version patch   # 1.0.0 → 1.0.1
   npm version minor   # 1.0.0 → 1.1.0
   npm version major   # 1.0.0 → 2.0.0
   ```

2. Publish to npm:
   ```bash
   npm publish
   ```

3. Verify the published package:
   ```bash
   npx cc-redact <<< '{"tool_input":{"file_path":"/dev/null"}}'
   ```

## What Gets Published

Controlled by the `files` field in `package.json`:

```
src/**/*.ts (excluding __tests__)
package.json
README.md
LICENSE
```

Test files, configuration files, and development artifacts are excluded.

## Post-publish

After publishing, users can use cc-redact by adding this to their project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "npx cc-redact"
          }
        ]
      }
    ]
  }
}
```

No cloning or local installation required.
