import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLayoutStore } from "@/stores/layoutStore";

/** Header bar shared by the file tree and preview columns — drag region + label only */
export function FilePanelHeader() {
  const { t } = useTranslation();
  const toggleFilePanel = useLayoutStore((s) => s.toggleFilePanel);

  return (
    <div className="shrink-0">
      <div
        data-tauri-drag-region
        className="flex h-[52px] items-center justify-between px-3"
      >
        <span className="text-[13px] font-semibold text-foreground-secondary">
          {t("preview.workspace")}
        </span>
        <button
          type="button"
          onClick={toggleFilePanel}
          className="rounded p-1.5 text-muted-foreground hover:bg-background-tertiary hover:text-foreground"
          title={t("preview.closeWorkspace")}
        >
          <X className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
      <Separator />
    </div>
  );
}
