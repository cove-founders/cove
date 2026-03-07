import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { getPreviewKind } from "@/lib/preview-types";
import { getFileIcon } from "@/lib/file-tree-icons";
import { useOpenFilePreview } from "@/hooks/useOpenFilePreview";

function basename(path: string): string {
  const segments = path.replace(/\/+$/, "").split("/");
  return segments[segments.length - 1] || path;
}

export interface FilePathChipProps {
  /** Absolute or workspace-relative path */
  path: string;
  /** Display name (defaults to basename) */
  label?: string;
  /** Link-like style for tool headers (no border/bg) */
  compact?: boolean;
}

export function FilePathChip({ path, label, compact }: FilePathChipProps) {
  const { open } = useOpenFilePreview();
  const displayName = label || basename(path);
  const kind = getPreviewKind(path);
  const isPreviewable = kind !== "unsupported";

  const handleClick = () => open(path);
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(path);
    }
  };

  if (compact) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex items-center gap-1 text-[13px] cursor-pointer",
          isPreviewable
            ? "text-foreground-secondary hover:text-accent hover:underline"
            : "text-foreground-tertiary hover:text-foreground-secondary hover:underline",
        )}
        title={path}
      >
        {getFileIcon(path, "size-3.5 shrink-0", 1.5)}
        <span className="min-w-0 truncate">{displayName}</span>
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background-secondary px-2 py-0.5 text-[12px] cursor-pointer transition-colors hover:border-accent/50 hover:bg-background-tertiary"
      title={path}
    >
      {getFileIcon(path, "size-3.5 shrink-0 text-foreground-secondary", 1.5)}
      <span className="min-w-0 truncate max-w-[200px]">{displayName}</span>
    </span>
  );
}
