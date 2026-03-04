import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Search,
  SquarePen,
  FolderOpen,
  Blocks,
  ChevronRight,
  PanelLeft,
  MessageSquare,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useDataStore } from "@/stores/dataStore";
import { useChatStore } from "@/stores/chatStore";
import { useLayoutStore, type ActivePage } from "@/stores/layoutStore";
import { ConversationList } from "./ConversationList";
import { SidebarUserArea } from "./SidebarUserArea";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function MainNavSidebar() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const activePage = useLayoutStore((s) => s.activePage);
  const setActivePage = useLayoutStore((s) => s.setActivePage);
  const historyCollapsed = useLayoutStore((s) => s.historyCollapsed);
  const toggleHistory = useLayoutStore((s) => s.toggleHistory);
  const toggleLeft = useLayoutStore((s) => s.toggleLeftSidebar);

  const setActiveConversation = useDataStore((s) => s.setActiveConversation);

  const handleNewChat = useCallback(() => {
    setActiveConversation(null);
    useChatStore.getState().reset();
    setActivePage("chat");
  }, [setActiveConversation, setActivePage]);

  const handleNavClick = useCallback(
    (page: ActivePage) => {
      setActivePage(page);
    },
    [setActivePage],
  );

  /* Cmd+F to focus search when sidebar is open */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="no-select flex h-full w-full flex-col overflow-hidden">
      {/* macOS traffic light spacer + sidebar toggle */}
      <div data-tauri-drag-region className="flex h-[52px] shrink-0 items-center">
        <div className="w-[76px] shrink-0" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleLeft}
          className="text-muted-foreground hover:text-foreground"
          title="Toggle sidebar"
        >
          <PanelLeft className="size-[18px]" strokeWidth={1.5} />
        </Button>
      </div>

      {/* New Chat button */}
      <div className="px-3 pb-1.5">
        <Button
          variant="outline"
          className="h-8 w-full justify-start gap-2 text-[13px] font-normal"
          onClick={handleNewChat}
        >
          <SquarePen className="size-4" strokeWidth={1.5} />
          {t("sidebar.newChat", "New Chat")}
        </Button>
      </div>

      {/* Search box */}
      <div className="px-3 pb-2">
        <div
          className={cn(
            "flex h-[30px] items-center gap-2 rounded-md bg-background-tertiary/70 px-2.5 text-[13px] transition-colors",
            searchFocused && "bg-background-tertiary ring-1 ring-brand/15",
          )}
        >
          <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <input
            ref={searchRef}
            type="text"
            placeholder={t("sidebar.searchChats", "Search chats")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[13px] placeholder:text-muted-foreground focus:outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>

      {/* Nav menu items */}
      <div className="space-y-0.5 px-1.5 pb-1">
        <NavItem
          icon={<FolderOpen className="size-4 shrink-0" strokeWidth={1.5} />}
          label={t("sidebar.workspace", "Workspace")}
          active={activePage === "workspace"}
          onClick={() => handleNavClick("workspace")}
        />
        <NavItem
          icon={<Blocks className="size-4 shrink-0" strokeWidth={1.5} />}
          label={t("sidebar.extensionMarket", "Extension Market")}
          active={activePage === "extensions"}
          onClick={() => handleNavClick("extensions")}
        />
      </div>

      {/* History section — same NavItem style with collapsible chevron */}
      <div className="space-y-0.5 px-1.5">
        <button
          onClick={toggleHistory}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
            activePage === "chat"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
          )}
        >
          <MessageSquare className="size-4 shrink-0" strokeWidth={1.5} />
          <span className="truncate">{t("sidebar.chatHistory", "Chat History")}</span>
          <ChevronRight
            className={cn(
              "ml-auto size-3 text-muted-foreground transition-transform duration-200",
              !historyCollapsed && "rotate-90",
            )}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* Conversation list — scrollable, hides when history collapsed */}
      {!historyCollapsed && <ConversationList searchQuery={searchQuery} />}
      {historyCollapsed && <div className="min-h-0 flex-1" />}

      {/* Bottom user area */}
      <SidebarUserArea />
    </div>
  );
}
