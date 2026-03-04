import { ChatArea } from "@/components/chat/ChatArea";
import { useLayoutStore } from "@/stores/layoutStore";
import { useState } from "react";

/**
 * Conversation mode content: full-width ChatArea.
 * Shown when activePage === "chat".
 */
export function ConversationContent() {
  const leftOpen = useLayoutStore((s) => s.leftSidebarOpen);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <ChatArea
        leftSidebarOpen={leftOpen}
        modelSelectorOpen={modelSelectorOpen}
        onModelSelectorOpenChange={setModelSelectorOpen}
      />
    </div>
  );
}
