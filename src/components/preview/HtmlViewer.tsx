import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Code, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { CodeViewer } from "@/components/preview/CodeViewer";
import { cn } from "@/lib/utils";

const IS_WEB_URL = /^(https?:\/\/|data:|#|blob:)/;

function getBaseDir(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  return idx >= 0 ? filePath.substring(0, idx) : "";
}

function normalizePath(path: string): string {
  const parts = path.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === "..") normalized.pop();
    else if (part !== "." && part !== "") normalized.push(part);
  }
  return (path.startsWith("/") ? "/" : "") + normalized.join("/");
}

function loadHtmlImageDataUrl(
  src: string,
  basePath: string,
  workspaceRoot?: string,
): Promise<string> {
  if (src.startsWith("/")) {
    return invoke<{ dataUrl: string }>("read_absolute_file_as_data_url", {
      args: { path: src },
    }).then((r) => r.dataUrl);
  }
  const relativePath = basePath.startsWith(workspaceRoot ?? "")
    ? normalizePath((basePath.slice(workspaceRoot?.length ?? 0).replace(/^\//, "") + "/" + src).replace(/^\//, ""))
    : src;
  return invoke<{ dataUrl: string }>("read_file_as_data_url", {
    args: { workspaceRoot: workspaceRoot ?? basePath, path: relativePath },
  }).then((r) => r.dataUrl);
}

async function resolveLocalImages(html: string, basePath: string, workspaceRoot?: string): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const imgs = doc.querySelectorAll("img[src]");
  const tasks: Promise<void>[] = [];
  for (const img of imgs) {
    const src = img.getAttribute("src");
    if (!src || IS_WEB_URL.test(src)) continue;
    tasks.push(
      loadHtmlImageDataUrl(src, basePath, workspaceRoot)
        .then((dataUrl) => { img.setAttribute("src", dataUrl); })
        .catch(() => {}),
    );
  }
  if (tasks.length === 0) return html;
  await Promise.all(tasks);
  return doc.body.innerHTML;
}

interface HtmlViewerProps {
  code: string;
  path: string;
  basePath?: string;
  workspaceRoot?: string;
  className?: string;
}

export function HtmlViewer({ code, path, basePath, workspaceRoot, className }: HtmlViewerProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const cleanHtml = useMemo(() => {
    return DOMPurify.sanitize(code, {
      FORBID_TAGS: ["script", "noscript"],
      FORBID_ATTR: [
        "onerror", "onclick", "onload", "onmouseover", "onmouseout",
        "onmousedown", "onmouseup", "onfocus", "onblur", "onchange",
        "onsubmit", "onkeydown", "onkeyup", "onkeypress",
      ],
      ALLOW_DATA_ATTR: false,
    });
  }, [code]);

  const [resolvedHtml, setResolvedHtml] = useState(cleanHtml);

  useEffect(() => {
    setResolvedHtml(cleanHtml);
    const resolvedBase = basePath ?? getBaseDir(path);
    if (!resolvedBase) return;
    let stale = false;
    resolveLocalImages(cleanHtml, resolvedBase, workspaceRoot)
      .then((html) => { if (!stale) setResolvedHtml(html); });
    return () => { stale = true; };
  }, [cleanHtml, path, basePath, workspaceRoot]);

  const sanitizedHtml = useMemo(() => {
    const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">`;
    return `<!DOCTYPE html><html><head>${csp}<style>body{margin:8px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;}</style></head><body>${resolvedHtml}</body></html>`;
  }, [resolvedHtml]);

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
