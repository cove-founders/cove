---
name: cove-core
description: "Cove core capabilities: built-in JavaScript interpreter, file operations, and core tool usage guide."
emoji: "🏠"
always: true
---

You have a **built-in QuickJS JavaScript interpreter** available via the `cove_interpreter` tool. You CAN execute JavaScript code directly — no external runtime or installation required.

## Rule: prefer `cove_interpreter` over `bash` for JS-capable tasks

**ALWAYS use `cove_interpreter` (not bash) for:**
- Math calculations and numeric analysis
- JSON parsing, transforming, and formatting
- String processing and regex matching
- Reading workspace files and processing their content
- Quick data aggregation (sum, average, filter, sort)
- Any task expressible in pure JavaScript
- Office document operations: extract text, replace text, convert to PDF, apply formatting

**Use `bash` only when `cove_interpreter` cannot help:**
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
| `workspace.listDir(path)` | List directory contents |
| `workspace.officellm(cmd, args)` | Call office document CLI or Server mode (returns JSON string → use `JSON.parse()`). Note: the JS API name remains `officellm` for backward compatibility. |
| `Math.*`, `JSON.*`, `Date`, `RegExp`, `Map`, `Set` | Standard JS built-ins |

**Not available**: `fetch`, `require`, `import`, `process`, `fs`, `XMLHttpRequest`.

## Using `workspace.officellm`

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

```javascript
// Extract text from a Word document
const res = JSON.parse(workspace.officellm("extract-text", { i: "report.docx" }));
if (res.status === "success") {
  console.log(res.data.text);
}

// Replace text and save as new file
workspace.officellm("replace-text", { i: "doc.docx", o: "doc-new.docx", find: "foo", replace: "bar" });
```

All paths are relative to workspace root.

## Tool Selection Priority

### Document operations (DOCX/PPTX/XLSX)

1. **`cove_interpreter` + `workspace.officellm()`** -- preferred for most operations (stateless CLI or persistent server mode)
2. **`office` Tauri tool** -- when `cove_interpreter` is insufficient (e.g. complex session management)
3. MUST load OfficeLLM skill (via the `skill` tool) before calling any command by name

### Common mistakes to avoid

- Do NOT call `office` tool with `action:"call"` before loading the OfficeLLM skill -- you will guess wrong command names
- Do NOT use `bash` to run officellm CLI when `cove_interpreter` or the `office` Tauri tool is available
- Do NOT use `bash` for JSON parsing or math -- use `cove_interpreter`
- Do NOT guess command parameters -- load the skill first, then use exact names from the reference
