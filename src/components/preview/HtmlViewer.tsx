import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Code, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CodeViewer } from "@/components/preview/CodeViewer";
import { cn } from "@/lib/utils";

interface HtmlViewerProps {
  code: string;
  path: string;
  className?: string;
}

export function HtmlViewer({ code, path, className }: HtmlViewerProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const sanitizedHtml = useMemo(() => {
    const clean = DOMPurify.sanitize(code, {
      FORBID_TAGS: ["script", "noscript"],
      FORBID_ATTR: [
        "onerror", "onclick", "onload", "onmouseover", "onmouseout",
        "onmousedown", "onmouseup", "onfocus", "onblur", "onchange",
        "onsubmit", "onkeydown", "onkeyup", "onkeypress",
      ],
      ALLOW_DATA_ATTR: false,
    });
    const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">`;
    return `<!DOCTYPE html><html><head>${csp}<style>body{margin:8px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;}</style></head><body>${clean}</body></html>`;
  }, [code]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="flex shrink-0 items-center justify-end px-3 py-1.5">
        <div className="flex rounded-lg border">
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px]",
              viewMode === "preview"
                ? "bg-background/80 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="size-3.5" strokeWidth={1.5} />
            {t("preview.previewTab")}
          </button>
          <button
            type="button"
            onClick={() => setViewMode("code")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px]",
              viewMode === "code"
                ? "bg-background/80 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Code className="size-3.5" strokeWidth={1.5} />
            {t("preview.codeTab")}
          </button>
        </div>
      </div>
      {viewMode === "preview" ? (
        <iframe
          srcDoc={sanitizedHtml}
          sandbox=""
          title="HTML Preview"
          className="min-h-0 flex-1 border-none bg-white"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-1.5">
          <CodeViewer path={path} code={code} className="file-preview-code" />
        </div>
      )}
    </div>
  );
}
