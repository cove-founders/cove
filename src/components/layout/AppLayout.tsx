import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useLayoutStore, SIDEBAR_MIN, SIDEBAR_MAX } from "@/stores/layoutStore";
import { useDataStore } from "@/stores/dataStore";
import { useChatStore } from "@/stores/chatStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useFilePreviewStore } from "@/stores/filePreviewStore";
import { MainNavSidebar } from "@/components/sidebar/MainNavSidebar";
import { SearchMessagesDialog } from "@/components/sidebar/SearchMessagesDialog";
import { ConversationContent } from "./ConversationContent";
import { WorkspaceContent } from "./WorkspaceContent";
import { ResizeHandle } from "./ResizeHandle";
import { openSettingsWindow } from "@/lib/settings-window";
import { useEffect, useState, useCallback, lazy, Suspense } from "react";

const ExtensionMarketPage = lazy(
  () => import("@/components/extensions/ExtensionMarketPage"),
);

export function AppLayout() {
  const activePage = useLayoutStore((s) => s.activePage);
  const leftOpen = useLayoutStore((s) => s.leftSidebarOpen);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);
  const leftSidebarWidth = useLayoutStore((s) => s.leftSidebarWidth);
  const setLeftSidebarWidth = useLayoutStore((s) => s.setLeftSidebarWidth);
  const setActivePage = useLayoutStore((s) => s.setActivePage);

  const setActiveConversation = useDataStore((s) => s.setActiveConversation);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setWorkspaceRoot = useFilePreviewStore((s) => s.setWorkspaceRoot);

  const [searchMessagesOpen, setSearchMessagesOpen] = useState(false);

  const handleNewChat = useCallback(() => {
    setActiveConversation(null);
    useChatStore.getState().reset();
    setActivePage("chat");
  }, [setActiveConversation, setActivePage]);

  /* Sync workspace root to filePreviewStore */
  useEffect(() => {
    setWorkspaceRoot(activeWorkspace?.path ?? null);
  }, [activeWorkspace?.path, setWorkspaceRoot]);

  /* Start/stop workspace file watcher */
  useEffect(() => {
    const root = activeWorkspace?.path?.trim() ?? "";
    invoke("watch_workspace_command", { args: { workspaceRoot: root } }).catch(() => {});
  }, [activeWorkspace?.path]);

  /* File change events: refresh preview or handle deletion */
  useEffect(() => {
    const unlistenPromise = listen<{ path: string; kind: string }>(
      "workspace-file-changed",
      (event) => {
        const { path, kind } = event.payload ?? {};
        if (!path) return;
        const store = useFilePreviewStore.getState();
        if (kind === "modify") {
          store.invalidate(path);
        } else if (kind === "remove") {
          if (store.selectedPath === path) {
            store.setSelected(null);
            store.setPreviewError("file-deleted");
          }
          store.invalidate(path);
        }
      },
    );
    return () => { unlistenPromise.then((u) => u()); };
  }, []);

  /* macOS menu bar Settings */
  useEffect(() => {
    const unlistenPromise = listen("open-settings", () => openSettingsWindow());
    return () => { unlistenPromise.then((u) => u()); };
  }, []);

  /* Global keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.shiftKey && e.key === "b") {
        e.preventDefault();
        toggleLeft();
      }
      if (meta && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
      if (meta && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setSearchMessagesOpen(true);
      }
      if (meta && e.key === ",") {
        e.preventDefault();
        openSettingsWindow();
      }
      if (meta && e.shiftKey && e.key === "W") {
        e.preventDefault();
        setActivePage(activePage === "workspace" ? "chat" : "workspace");
      }
      if (meta && e.shiftKey && e.key === "E") {
        e.preventDefault();
        setActivePage(activePage === "extensions" ? "chat" : "extensions");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleLeft, handleNewChat, activePage, setActivePage]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      {/* Main navigation sidebar */}
      {leftOpen ? (
        <div
          className="relative flex shrink-0 flex-col overflow-hidden border-r border-sidebar-border transition-[width,min-width] duration-300 ease-out"
          style={{ width: leftSidebarWidth, minWidth: SIDEBAR_MIN }}
        >
          <MainNavSidebar />
          <ResizeHandle
            side="left"
            currentWidth={leftSidebarWidth}
            onResize={setLeftSidebarWidth}
            minWidth={SIDEBAR_MIN}
            maxWidth={SIDEBAR_MAX}
          />
        </div>
      ) : (
        <div className="w-0 min-w-0 overflow-hidden transition-[width,min-width] duration-300 ease-out" />
      )}

      {/* Main content — switches by activePage */}
      <div className="flex min-w-0 flex-1">
        {activePage === "chat" && <ConversationContent />}
        {activePage === "workspace" && <WorkspaceContent />}
        {activePage === "extensions" && (
          <Suspense fallback={
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Loading...
            </div>
          }>
            <ExtensionMarketPage />
          </Suspense>
        )}
      </div>

      <SearchMessagesDialog
        open={searchMessagesOpen}
        onOpenChange={setSearchMessagesOpen}
      />
    </div>
  );
}
