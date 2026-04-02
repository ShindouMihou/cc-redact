# Claude Code Redact

A Claude Code PreToolUse hook that automatically redacts secrets from files before Claude can read them.

Claude sees the structure and keys of secret files, but never the actual secret values. Redaction is automatic, type-preserving, and format-aware.

## Quick Start

1. Install globally with the install script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/ShindouMihou/cc-redact/main/install.sh | bash
   ```
   This auto-detects your package manager (npx, bunx, or pnpm dlx) and adds the hooks to `~/.claude/settings.json`.

2. Create a `.redactcc` file in any project root to define which files to redact (optional — see below).

That's it. No cloning, no local install. `npx` fetches and runs cc-redact automatically.

> **Note:** cc-redact works with Node.js 18+ or Bun. You can also use `bunx cc-redact` if you prefer Bun.

<details>
<summary>Manual Setup</summary>

If you prefer to configure manually, add this to your `.claude/settings.json` (project or global):

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
    ],
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "npx cc-redact --cleanup"
          }
        ]
      }
    ]
  }
}
```

The `PostToolUse` hook automatically cleans up temporary redacted files after Claude finishes reading them.

</details>

## Configuration

Configure which files to redact by creating a `.redactcc` file in your project root. The format is line-based, similar to `.gitignore`:

- One glob pattern per line
- Lines starting with `#` are comments
- Empty lines are ignored
- Patterns use standard glob syntax (supports `*`, `**`, `?`, `[abc]`)

### Example `.redactcc`

```
# Environment files
.env
.env.*
.env.local

# Config files with secrets
config/secrets.json
config/database.yaml

# Credentials
*.pem
*.key
credentials.toml
```

### Default Patterns

If no `.redactcc` file exists, the hook defaults to redacting:
- `.env`
- `.env.*`

This ensures `.env.local`, `.env.production`, and similar files are protected by default.

## Supported Formats

The hook auto-detects file format by extension and applies format-specific redaction:

| Format | Extensions | Redaction Behavior |
|--------|------------|--------------------|
| ENV | `.env`, `.env.*` | Redact values, preserve keys and comments |
| JSON / JSONC | `.json`, `.jsonc` | Redact all values, preserve structure |
| YAML | `.yaml`, `.yml` | Redact all values, preserve structure and comments |
| TOML | `.toml` | Redact all values, preserve structure |
| Opaque | `.pem`, `.key`, etc. | Deny read (block entirely) |

## Redaction Rules

Redaction is **type-preserving**: values are replaced with type-safe placeholders.

### Environment Files (`.env`)

Keys and comments are preserved. All values become `{{REDACTED}}`.

**Before:**
```env
# Database credentials
DB_HOST=prod-db.example.com
DB_USER=admin
DB_PASSWORD=super_secret_password
API_KEY=sk-12345abcde
```

**After:**
```env
# Database credentials
DB_HOST={{REDACTED}}
DB_USER={{REDACTED}}
DB_PASSWORD={{REDACTED}}
API_KEY={{REDACTED}}
```

### JSON / JSONC Files (`.json`, `.jsonc`)

Structure is preserved. Values are replaced based on type:
- Strings: `"{{REDACTED}}"`
- Numbers: `0`
- Booleans: `false`
- Null: `null` (unchanged)

**Before:**
```json
{
  "database": {
    "host": "prod-db.example.com",
    "port": 5432,
    "user": "admin",
    "password": "super_secret",
    "ssl": true
  }
}
```

**After:**
```json
{
  "database": {
    "host": "{{REDACTED}}",
    "port": 0,
    "user": "{{REDACTED}}",
    "password": "{{REDACTED}}",
    "ssl": false
  }
}
```

### YAML Files (`.yaml`, `.yml`)

Structure and comments are preserved. Scalar values are replaced based on type:
- Strings: `{{REDACTED}}`
- Numbers: `0`
- Booleans: `false`

**Before:**
```yaml
# Production database
database:
  host: prod-db.example.com
  port: 5432
  password: super_secret
  ssl: true
```

**After:**
```yaml
# Production database
database:
  host: {{REDACTED}}
  port: 0
  password: {{REDACTED}}
  ssl: false
```

### TOML Files (`.toml`)

Structure is preserved. Values are replaced based on type (strings, numbers, booleans, dates).

**Before:**
```toml
[database]
host = "prod-db.example.com"
port = 5432
password = "super_secret"
ssl = true
```

**After:**
```toml
[database]
host = "{{REDACTED}}"
port = 0
password = "{{REDACTED}}"
ssl = false
```

### Opaque Files (`.pem`, `.key`, etc.)

Files with unrecognized extensions that match a `.redactcc` pattern are denied entirely. Claude cannot read them. This prevents accidental exposure of binary credentials or certificate files.

## How It Works

1. **Hook Registration**: The `.claude/settings.json` registers this project as a PreToolUse hook for the Read tool.

2. **Pattern Matching**: When Claude attempts to read a file, the hook checks if the file path matches any patterns in `.redactcc`.

3. **Format Detection**: If matched, the hook detects the file format by extension.

4. **Redaction**: For recognized formats (ENV, JSON, YAML, TOML), the hook:
   - Reads the original file
   - Applies format-specific redaction
   - Writes the redacted version to a temporary file in `/tmp/cc-redact/`

5. **Redirect**: Claude is transparently redirected to read the temp file instead.

6. **Deny**: For opaque formats (unknown extensions), the hook denies the read entirely.

7. **Pass-Through**: If the file doesn't match any pattern, it's read normally (no redaction).

8. **Cleanup**: After Claude finishes reading, the `--cleanup` PostToolUse hook deletes the temporary redacted file from `/tmp/cc-redact/`.

### Error Handling

If any error occurs during redaction (missing file, parse error, write failure), the hook blocks Claude from reading the file.

## Limitations

- **`@` file references are not intercepted.** When you reference a file with `@.env` in your prompt, Claude Code inlines the file contents directly into the context — it does not use the `Read` tool. Hooks can only intercept tool calls, so `@`-referenced files bypass redaction entirely. This hook protects against Claude autonomously reading secret files during tasks, not against the user explicitly attaching them.

## Testing

Run the test suite with:

```bash
bun test
```

Tests verify:
- Pattern matching against various file paths
- Redaction of each supported format
- Preservation of structure and type safety
- Handling of multiline ENV values
- Comment preservation in YAML and ENV files

## Development

This project uses Bun and TypeScript.

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build (if needed)
bun build src/main.ts
```

### Project Structure

```
src/
  main.ts           # Hook entry point, reads stdin and outputs result
  redact.ts         # Core redaction logic and file matching
  config.ts         # .redactcc parsing and pattern loading
  format.ts         # File format detection
  types.ts          # TypeScript types
  redactors/        # Format-specific redaction modules
    env.ts          # ENV file redaction
    json.ts         # JSON/JSONC redaction
    yaml.ts         # YAML redaction
    toml.ts         # TOML redaction
    index.ts        # Redactor registry
```
