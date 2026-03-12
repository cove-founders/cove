import { tool } from "ai";
import { z } from "zod/v4";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useFilePreviewStore } from "@/stores/filePreviewStore";
import { useDataStore } from "@/stores/dataStore";
import { recordRead } from "../file-time";
import { isOfficeReadable } from "./office-extensions";

const DEFAULT_LIMIT = 2000;

interface FsErrorPayload {
  kind: string;
  message?: string;
}

function isFsError(err: unknown): err is FsErrorPayload {
  return typeof err === "object" && err !== null && "kind" in err;
}

interface ReadOfficeTextResult {
  fileType: string;
  content: string;
  truncated: boolean;
  warnings: string[];
}

function formatOfficeText(content: string, fileType: string, filePath: string): string {
  const lines = content.split("\n");
  let out = `[Office Document: ${filePath} (${fileType})]\n`;
  for (let i = 0; i < lines.length; i++) {
    const lineNo = String(i + 1).padStart(5, "0");
    out += `${lineNo}| ${lines[i]}\n`;
  }
  return out;
}

function handleFsError(err: unknown, filePath: string): string {
  if (!isFsError(err)) {
    return `读取失败：${err instanceof Error ? err.message : String(err)}`;
  }
  switch (err.kind) {
    case "OutsideWorkspace":
      return "该路径不在当前工作区内，无法读取。";
    case "NotFound":
      return `文件不存在：${filePath}`;
    case "BinaryFile":
      return "该文件被识别为二进制，无法以文本形式读取。";
    case "TooLarge":
      return "文件超过 250KB 上限，请使用 offset/limit 分段读取。";
    case "NotAllowed":
      return err.message ? `无法读取：${err.message}` : "无法读取该路径。";
    default:
      return err.message ? `错误：${err.message}` : `错误：${err.kind}`;
  }
}

export const readTool = tool({
  description:
    "Read the contents of a file. Supports text files and Office documents (DOCX/XLSX/PPTX/PDF). " +
    "For files in the current workspace use a relative path. " +
    "For files from other workspaces (e.g. shown as '[File: name at /abs/path]' in workspace context) use the absolute path exactly as shown after 'at'. " +
    "Returns line-numbered text. Use offset/limit for large text files.",
  inputSchema: z.object({
    filePath: z.string().describe(
      "File path. Use the absolute path shown after 'at' in workspace context for cross-workspace files, " +
      "or a relative path from workspace root for files in the current workspace."
    ),
    offset: z.number().optional().describe("Skip this many lines (0-based, text files only)"),
    limit: z.number().optional().describe("Max lines to return (default 2000, text files only)"),
  }),
  execute: async ({ filePath, offset, limit }) => {
    const activeWorkspace = useWorkspaceStore.getState().activeWorkspace;
    const selectedWorkspaceRoot = useFilePreviewStore.getState().selectedWorkspaceRoot;
    let workspaceRoot = selectedWorkspaceRoot ?? activeWorkspace?.path;
    if (!workspaceRoot) {
      return "请先在输入框上方选择工作区目录，再使用 read 工具。";
    }

    // For absolute paths, find the registered workspace that owns the file.
    // This allows cross-workspace reads when multiple workspaces are selected.
    if (filePath.startsWith("/")) {
      const { workspaces } = useWorkspaceStore.getState();
      for (const ws of workspaces) {
        const normalized = ws.path.endsWith("/") ? ws.path : ws.path + "/";
        if (filePath === ws.path || filePath.startsWith(normalized)) {
          workspaceRoot = ws.path;
          break;
        }
      }
    }
    const sessionId = useDataStore.getState().activeConversationId;

    // For relative paths that fail in the current workspace, fall back to other registered workspaces.
    // This handles cross-workspace reads when the AI passes a relative path.
    const candidateRoots: string[] = [workspaceRoot];
    if (!filePath.startsWith("/")) {
      const { workspaces } = useWorkspaceStore.getState();
      for (const ws of workspaces) {
        if (ws.path && ws.path !== workspaceRoot) {
          candidateRoots.push(ws.path);
        }
      }
    }

    if (isOfficeReadable(filePath)) {
      for (const root of candidateRoots) {
        try {
          const result = await invoke<ReadOfficeTextResult>("read_office_text", {
            args: { workspaceRoot: root, path: filePath },
          });
          const abs = filePath.startsWith("/") ? filePath : `${root}/${filePath}`.replace(/\/+/g, "/");
          if (sessionId) recordRead(sessionId, abs);
          return formatOfficeText(result.content, result.fileType, filePath);
        } catch (err) {
          if (candidateRoots.indexOf(root) < candidateRoots.length - 1) continue;
          return handleFsError(err, filePath);
        }
      }
    }

    for (const root of candidateRoots) {
      try {
        const content = await invoke<string>("read_file", {
          args: {
            workspaceRoot: root,
            path: filePath,
            offset: offset ?? undefined,
            limit: limit ?? DEFAULT_LIMIT,
          },
        });
        const abs = filePath.startsWith("/") ? filePath : `${root}/${filePath}`.replace(/\/+/g, "/");
        if (sessionId) recordRead(sessionId, abs);
        return content;
      } catch (err) {
        if (candidateRoots.indexOf(root) < candidateRoots.length - 1) continue;
        return handleFsError(err, filePath);
      }
    }
  },
});
