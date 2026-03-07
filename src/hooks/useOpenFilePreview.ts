import { useCallback } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { useFilePreviewStore } from "@/stores/filePreviewStore";
import { useLayoutStore } from "@/stores/layoutStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { getPreviewKind } from "@/lib/preview-types";

/** Resolve a possibly-relative path to absolute using the active workspace root */
function resolveAbsolute(path: string, workspaceRoot: string | null): string {
  if (path.startsWith("/")) return path;
  if (!workspaceRoot) return path;
  const root = workspaceRoot.endsWith("/") ? workspaceRoot : workspaceRoot + "/";
  return root + path;
}

export function useOpenFilePreview() {
  const setSelected = useFilePreviewStore((s) => s.setSelected);
  const setFilePanelOpen = useLayoutStore((s) => s.setFilePanelOpen);
  const workspaceRoot = useWorkspaceStore((s) => s.activeWorkspace?.path ?? null);

  const openPreview = useCallback(
    (path: string) => {
      const resolved = resolveAbsolute(path, workspaceRoot);
      setSelected(resolved);
      if (!useLayoutStore.getState().filePanelOpen) {
        setFilePanelOpen(true);
      }
    },
    [setSelected, setFilePanelOpen, workspaceRoot],
  );

  const openExternal = useCallback(
    (path: string) => {
      const resolved = resolveAbsolute(path, workspaceRoot);
      if (resolved.startsWith("/")) {
        openPath(resolved).catch((e) => console.error("openPath failed:", e));
      } else if (workspaceRoot) {
        invoke("open_with_app", {
          args: { workspaceRoot, path, openWith: null },
        }).catch((e) => console.error("open_with_app failed:", e));
      }
    },
    [workspaceRoot],
  );

  const open = useCallback(
    (path: string) => {
      const kind = getPreviewKind(path);
      if (kind === "unsupported") {
        openExternal(path);
      } else {
        openPreview(path);
      }
    },
    [openPreview, openExternal],
  );

  return { openPreview, openExternal, open };
}
