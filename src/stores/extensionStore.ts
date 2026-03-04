import { create } from "zustand";

export type ExtensionTab = "skills" | "mcp" | "plugin" | "subagent";
export type CreateDialogType = "skill" | "mcp" | "subagent" | null;

interface ExtensionState {
  activeTab: ExtensionTab;
  setActiveTab: (tab: ExtensionTab) => void;
  createDialogType: CreateDialogType;
  setCreateDialogType: (type: CreateDialogType) => void;
}

export const useExtensionStore = create<ExtensionState>()((set) => ({
  activeTab: "skills",
  setActiveTab: (tab) => set({ activeTab: tab }),
  createDialogType: null,
  setCreateDialogType: (type) => set({ createDialogType: type }),
}));
