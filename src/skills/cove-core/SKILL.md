---
name: cove-core
description: "Cove core capabilities: built-in JavaScript interpreter, file operations, and core tool usage guide."
emoji: "🏠"
always: true
---

## Principle: use dedicated tools first, write code only when tools are insufficient

When a dedicated tool can accomplish a task, call the tool directly. Write code (cove_interpreter) only when tools cannot do the job alone — e.g., data processing, multi-step transformations, combining multiple tool results programmatically.

You have a built-in QuickJS JavaScript interpreter via `cove_interpreter`. Use it for computation and data processing, not as a wrapper around dedicated tools.

Use `cove_interpreter` for:
- Math calculations and numeric analysis
- JSON parsing, transforming, and formatting
- String processing and regex matching
- Data aggregation (sum, average, filter, sort)
- Multi-step logic combining results from multiple tool calls
- Complex programmatic workflows that no single tool can handle

Use `cove_interpreter` over `bash` when:
- The task is pure computation (math, JSON, string processing) with no system interaction
- You need to process or transform data returned by tool calls

Use `bash` for system interaction:
- System commands: `git`, `npm`, `cargo`, `pnpm`, etc.
- Shell features: pipes, redirects, environment variables
- Network access: `curl`, `wget`
- Language-specific toolchains: `rustc`, `tsc`, `python`

## Available APIs

| API | Usage |
|-----|-------|
| `console.log/warn/error` | Output to result |
| `workspace.readFile(path)` | Read a file (relative to workspace root) |
| `workspace.writeFile(path, content)` | Write a file |
| `workspace.appendFile(path, content)` | Append content to a file (creates if not exists) |
| `workspace.listDir(path)` | List directory contents |
| `workspace.exists(path)` | Check if file/directory exists (returns boolean) |
| `workspace.stat(path)` | Get file metadata: `{ size, mtime, isDir, isBinary }` |
| `workspace.copyFile(src, dst)` | Copy a file (auto-creates parent directories) |
| `workspace.moveFile(src, dst)` | Move/rename a file |
| `workspace.remove(path)` | Delete a file or empty directory (safe: no recursive delete) |
| `workspace.createDir(path)` | Create directory (including intermediate directories) |
| `workspace.glob(pattern)` | Search files by glob pattern, returns relative paths (max 1000) |
| `workspace.officellm(cmd, args)` | Call office document CLI or Server mode (returns JSON string). Note: the JS API name remains `officellm` for backward compatibility. |
| `Math.*`, `JSON.*`, `Date`, `RegExp`, `Map`, `Set` | Standard JS built-ins |

**Not available**: `fetch`, `require`, `import`, `process`, `fs`, `XMLHttpRequest`.

## JS Code Conventions

### Keep it short

Target 10-30 lines. Over 40 lines means you should reconsider the approach (split into multiple tool calls, or use a dedicated tool instead). Use `Array.map/filter/reduce/forEach`, destructuring, template literals, and ternaries to stay concise.

### Structure with functions

Extract repeated logic into helper functions at the top. Main logic goes at the bottom, calling helpers.

```javascript
// helper at top
const lineCount = (text) => text.split("\n").length;

// main logic at bottom
const files = workspace.glob("src/**/*.ts");
const counts = files.map(f => ({ file: f, lines: lineCount(workspace.readFile(f)) }));
console.log(JSON.stringify(counts, null, 2));
```

### Error handling

Wrap `workspace.*` calls in try/catch. Log context (file path, operation) so you can self-correct on retry.

```javascript
try {
  const content = workspace.readFile(path);
  // ...
} catch (e) {
  console.error(`readFile ${path}: ${e.message}`);
}
```

### Output formatting

- Data results: `console.log(JSON.stringify(result, null, 2))` once at end.
- Summaries: clear labels like `console.log("Total: " + count)`.
- Don't scatter `console.log` throughout the code. Collect results first, output once.

### Use workspace APIs, don't reinvent

| Do this | Not this |
|---------|----------|
| `workspace.exists(path)` | try-read-catch to check existence |
| `workspace.glob("**/*.ts")` | recursive listDir + filter |
| `workspace.stat(path).size` | read file to check length |
| `workspace.copyFile(src, dst)` | read + write to copy |
| `workspace.appendFile(path, line)` | read + concat + write to append |

### officellm patterns

- Always `JSON.parse()` the return value of `workspace.officellm()`.
- Always check `status` before `open`. Always `close` when done.
- For multi-step workflows: open -> operate -> save -> close.
- Wrap officellm calls in try/catch; log the command name in error messages.

```javascript
try {
  const res = JSON.parse(workspace.officellm("extract-text", { i: "report.docx" }));
  if (res.status === "success") console.log(res.data.text);
} catch (e) {
  console.error(`officellm extract-text: ${e.message}`);
}
```

## workspace.officellm API (advanced: multi-step programmatic workflows)

When you need to combine multiple office operations in a single programmatic sequence
(e.g., open -> multiple transforms -> save), use `workspace.officellm()` inside `cove_interpreter`.
For single operations, prefer the `office` Tauri tool directly.

### CLI mode (stateless, good for single operations)

```javascript
const res = JSON.parse(workspace.officellm("extract-text", { i: "report.docx" }));
console.log(res.data.text);
```

### Server mode (persistent session, good for multiple operations on the same document)

```javascript
workspace.officellm("open", { path: "doc.docx" });        // open session
workspace.officellm("replace-text", { find: "foo", replace: "bar" });
const saved = JSON.parse(workspace.officellm("save", {})); // save
workspace.officellm("close", {});                          // close session
```

`workspace.officellm` auto-routes:
- `"open"` → starts a `serve --stdio` process
- `"close"` → terminates the server process
- `"status"` → returns current session info (pid, path, uptime)
- any other cmd → JSON-RPC call if session is open, otherwise CLI subprocess

## Limits
- **Memory**: 64 MB  |  **Timeout**: 30s default (max 60s via `timeout` param)
- **No network**  |  **File scope**: active workspace only

## Example

Bad -- manual recursion, no error handling, scattered output, 20+ lines:

```javascript
// DON'T do this
const dirs = ["."];
let total = 0;
while (dirs.length > 0) {
  const d = dirs.pop();
  const entries = workspace.listDir(d);
  for (const e of entries) {
    const p = d + "/" + e;
    if (e.endsWith(".ts")) {
      const c = workspace.readFile(p);
      const n = c.split("\n").length;
      console.log(p + ": " + n);
      total += n;
    } else {
      try { dirs.push(...workspace.listDir(p).map(x => p + "/" + x)); } catch(_) {}
    }
  }
}
console.log("total: " + total);
```

Good -- workspace APIs, helpers, structured output, <15 lines:

```javascript
// DO this
const lineCount = (path) => workspace.readFile(path).split("\n").length;

const files = workspace.glob("**/*.ts");
const counts = files.map(f => {
  try { return { file: f, lines: lineCount(f) }; }
  catch (e) { console.error(`read ${f}: ${e.message}`); return null; }
}).filter(Boolean);

const total = counts.reduce((sum, c) => sum + c.lines, 0);
console.log(JSON.stringify({ total, fileCount: counts.length, files: counts }, null, 2));
```

All paths are relative to workspace root.

## Tool Selection Priority

### General rule

1. **Dedicated tool** — if a registered tool can do it, call the tool
2. **`cove_interpreter`** — for computation, data processing, or multi-step programmatic workflows
3. **`bash`** — for system interaction (git, npm, shell commands)

### Document operations (DOCX/PPTX/XLSX)

1. **`office` Tauri tool** — preferred for all single operations
2. **`cove_interpreter` + `workspace.officellm()`** — for multi-step programmatic workflows
3. MUST load OfficeLLM skill (via the `skill` tool) before calling any command by name

### Common mistakes to avoid

- Do NOT call `office` tool with `action:"call"` before loading the OfficeLLM skill — you will guess wrong command names
- Do NOT wrap a single office operation in `cove_interpreter` when the `office` tool can do it directly
- Do NOT use `bash` to run officellm CLI when the `office` Tauri tool is available
- Do NOT use `bash` for JSON parsing or math — use `cove_interpreter`
- Do NOT guess command parameters — load the skill first

## Boundaries

### Preflight checks (before acting)

- **File exists?** Before `edit` or `write` (overwrite), read the file first. Before referencing a file path in any tool, verify it exists.
- **Session state?** Before `workspace.officellm("open", ...)` or `office` tool `action:"open"`, check `status` first. If a session is active, close it before opening a new one. Never assume session state from earlier turns — check.
- **Tool available?** Before using `office` or `bash` with `officellm`, run `detect` or `doctor` at least once per conversation. If a dependency is missing, tell the user and offer installation steps.
- **Workspace set?** If no workspace is selected, tell the user to set one before attempting file or interpreter operations.

### When to refuse or defer

- **Destructive operations**: Deleting files, overwriting without backup, `rm -rf` — state what will be lost and wait for explicit confirmation.
- **Ambiguous intent**: Multiple valid interpretations → present 2-3 options and let the user choose. Do not guess.
- **Subjective output**: Design choices, naming, prose style — present your recommendation with reasoning, frame as suggestion.
- **Beyond capability**: Complex visual layouts, image editing, audio processing, tasks needing visual feedback loops — acknowledge honestly. Offer what you can do without pretending the result will be production-ready.

### Session coordination (officellm)

The officellm server is a process-wide singleton. Three paths share (or don't share) one session:

1. `workspace.officellm()` in cove_interpreter — shares Rust mutex
2. `office` Tauri tool — shares Rust mutex
3. `bash` + `officellm` CLI — independent process, no mutex coordination

Rules:
- Do NOT mix paths 1/2 with path 3 for server-mode operations
- Always check status before open. Always close when done.
- If open fails with "session already active", close first, then retry
- Prefer path 2 (office Tauri tool) for single operations; path 1 for multi-step programmatic workflows
