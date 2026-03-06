---
name: OfficeLLM
description: Bootstrap for bundled office tool — Tauri tool for document operations (DOCX/PPTX/XLSX).
emoji: "📄"
always: false
---

# Office (Bundled Tauri Tool)

ALWAYS use the `office` Tauri tool for document operations. Do NOT use `bash` to call `officellm` directly — the binary is not in PATH. All operations go through dedicated Tauri IPC commands via the `office` tool.

## Loading the Full Command Reference

For the complete command reference (~100 commands, workflows, best practices), use the `skill_resource` tool to load guides on demand. Do NOT guess command names.
