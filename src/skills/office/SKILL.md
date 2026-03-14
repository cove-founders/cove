---
name: OfficeLLM
description: Bootstrap for bundled office tool — Tauri tool for document operations (DOCX/PPTX/XLSX).
emoji: "📄"
always: false
---

# OfficeLLM Command Guide

## First step: discover, do not guess

When you use the bundled `office` tool and you are not certain about the command name or parameters, discover first:

1. `office(command: "help")`
2. `office(command: "list-commands")`
3. `office(command: "get-command-schema", args: { name: "<command>" })`
4. Only then execute the document command

For wrapper commands (`open`, `save`, `status`, etc.), inspect them with:

```text
office(command: "help", args: { name: "save" })
```

## Wrapper commands vs document commands

**Cove wrapper commands**
- `help`
- `detect`
- `doctor`
- `list-commands`
- `get-command-schema`
- `open`
- `create`
- `save`
- `close`
- `status`

**OfficeLLM document commands**
- Real runtime commands such as `replace-text`, `insert`, `extract-text`, `list-structure`
- Discover these at runtime with `list-commands` / `get-command-schema`

## Tool priority

1. **`office` tool** — single operations and command discovery
2. **`cove_interpreter` + officellm bridge** — multi-step workflows on the same document
3. **`skill_resource`** — workflow and mapping guides, not command schema lookup

## Single-operation examples

```text
office(command: "help")
office(command: "list-commands", args: { category: "Editing" })
office(command: "get-command-schema", args: { name: "replace-text" })
office(command: "open", args: { path: "report.docx" })
office(command: "replace-text", args: { find: "old", replace: "new" })
office(command: "save", args: { path: "report-final.docx" })
office(command: "close")
```

## Multi-step workflows

Use the built-in `cove_interpreter` officellm bridge when you need multiple operations on the same active document:

```lua
local doc = officellm.open("report.docx")
doc.call("replace-text", { find = "Draft", replace = "Final" })
doc.call("apply-format", { find = "Final", bold = true })
doc.save("report-final.docx")
doc.close()
```

## Session coordination

- `office` and `cove_interpreter` share one process-wide officellm session
- Check `office(command: "status")` before `open` if you suspect another document is active
- Always `close` when the workflow is done
- Do not use `bash` to run `officellm`; bundled office must go through the `office` tool

## Simple tasks: skip this skill

For simple read/write/merge tasks, the `read` and `write` tools handle DOCX directly without loading this skill. Only load this skill when you need advanced operations (formatting, find-replace, slide manipulation, spreadsheet formulas).

## Resources

Common mistakes:
- Do NOT call `office` tool before loading the OfficeLLM skill — you will guess wrong command names
- Do NOT wrap a single office operation in `cove_interpreter` when the `office` tool can do it directly
- Do NOT use `bash` to run officellm CLI — the binary is not in PATH
- Do NOT guess command parameters — load the skill first

## Loading the Full Command Reference

Run `doctor` first — the response includes a `home` field. For the complete command reference (~100 commands, workflows, best practices):

- `<home>/skills/resources/*.md` — detailed guides
- `<home>/skills/quickjs-examples/*.js` — scripting examples
- Use the `skill_resource` tool to load a specific guide on demand.

Do NOT guess command names — read the resource guides first.

## Dependency Check

Before any document operation, run `doctor` once per session:

1. Call `office` tool with `action: "doctor"`
2. Check `dependencies` array — each has `name`, `available`, `required`
3. Install missing **required** dependencies:

| Dependency  | Install (macOS)                   |
|-------------|-----------------------------------|
| libreoffice | `brew install --cask libreoffice` |
| pdftoppm    | `brew install poppler`            |
| quarto      | `brew install --cask quarto`      |

If Homebrew is missing or slow (China mainland), offer USTC mirror:
- Install: `/bin/bash -c "$(curl -fsSL https://mirrors.ustc.edu.cn/misc/brew-install.sh)"`
- Mirror config:
  ```
  export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.ustc.edu.cn/brew.git"
  export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.ustc.edu.cn/homebrew-core.git"
  export HOMEBREW_API_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles/api"
  export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.ustc.edu.cn/homebrew-bottles"
  ```

Use `bash` tool for install commands. Re-run `doctor` to confirm.

## Quick Reference (Common Operations)

These examples work without loading the full OfficeLLM skill. Prefer the `office` Tauri tool for single operations. Use `cove_interpreter` with `workspace.officellm()` only for multi-step programmatic workflows.

### Extract text from a document

```json
{ "action": "call", "command": "extract-text", "args": { "i": "report.docx" } }
```

For multi-step processing, use `cove_interpreter`:

```javascript
const res = JSON.parse(workspace.officellm("extract-text", { i: "report.docx" }));
console.log(res.data.text);
```

### Replace text in a document

```json
{ "action": "call", "command": "replace-text", "args": { "i": "doc.docx", "o": "doc-out.docx", "find": "old text", "replace": "new text" } }
```

### Server mode via cove_interpreter (multiple operations on one document)

```javascript
workspace.officellm("open", { path: "presentation.pptx" });
// ... multiple commands ...
workspace.officellm("save", {});
workspace.officellm("close", {});
```

### Check session status

```json
{ "action": "status" }
```

For the full command reference (~100 commands), run `doctor` and read the resource guides at `<home>/skills/resources/`.

## File Output Rule

Whenever a file is successfully written to disk (save, export, pack, convert, etc.), output the absolute path as a clickable markdown link:

```
[filename.docx](file:///absolute/path/to/filename.docx)
```

Always use the absolute path. Apply this to every generated, edited, or saved file.

- `resources/command-discovery.md` — exact discovery workflow for bundled office
- `resources/command-mapping.md` — common naming differences and when to use wrapper commands
