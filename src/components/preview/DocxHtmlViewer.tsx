/**
 * DocxHtmlViewer — renders DOCX documents using docx-preview-sync.
 *
 * Rendering strategy (two-stage):
 *   Stage 1: renderAsync (full layout + styles)
 *   Stage 2 (fallback): plain-text extraction via fflate + XML stripping
 *
 * Stage 2 kicks in whenever Stage 1 throws or rejects for any reason,
 * covering: missing ZIP entries, Windows backslash paths, null rels,
 * missing pgMar/pgSz, or any other malformed-DOCX scenario.
 *
 * Cache: L1 in-memory (module Map) — zero latency within the same session.
 */
import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview-sync";
import { unzipSync } from "fflate";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

// ── L1 in-memory cache ──────────────────────────────────────────────────────
const memCache = new Map<string, ArrayBuffer>();

function cacheKey(dataUrl: string): string {
  return `${dataUrl.length}:${dataUrl.slice(0, 64)}`;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ── Plain-text extraction (Stage 2 fallback) ────────────────────────────────

/**
 * Unzip DOCX and return the raw XML text of word/document.xml.
 * Handles both forward-slash and Windows backslash ZIP entry paths.
 */
function readDocumentXml(buf: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buf));
  // Some generators (e.g. WPS on Windows) use backslash separators in ZIP entries
  const entry =
    files["word/document.xml"] ??
    files["word\\document.xml"] ??
    // fallback: search case-insensitively
    Object.entries(files).find(([k]) =>
      k.toLowerCase().replace(/\\/g, "/") === "word/document.xml",
    )?.[1];
  if (!entry) throw new Error("document.xml not found in DOCX");
  return new TextDecoder("utf-8").decode(entry);
}

/**
 * Strip OOXML tags and extract readable paragraph text.
 * Preserves paragraph breaks and tab stops; discards all markup.
 */
function xmlToPlainText(xml: string): string {
  return (
    xml
      // Each paragraph → newline
      .replace(/<\/w:p>/gi, "\n")
      // Tab character
      .replace(/<w:tab[^/>]*(\/?>)/gi, "\t")
      // Soft line break
      .replace(/<w:br[^/>]*(\/?>)/gi, "\n")
      // Preserve text node content (w:t may carry xml:space="preserve")
      .replace(/<w:t[^>]*>([^<]*)<\/w:t>/gi, "$1")
      // Strip remaining tags
      .replace(/<[^>]+>/g, "")
      // Decode basic XML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // Normalise: trim each line, drop blank runs (keep intentional blank lines)
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ── Component ───────────────────────────────────────────────────────────────

interface DocxHtmlViewerProps {
  dataUrl: string;
  className?: string;
}

type Status = "idle" | "rendering" | "done" | "fallback" | "error";

export function DocxHtmlViewer({ dataUrl, className }: DocxHtmlViewerProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [plainText, setPlainText] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string>("");

  useEffect(() => {
    if (!dataUrl) return;

    pendingRef.current = dataUrl;
    setStatus("rendering");
    setError("");
    setPlainText("");

    const container = containerRef.current;
    if (!container) return;

    // Decode data URL → ArrayBuffer (cached)
    let buf: ArrayBuffer;
    try {
      const key = cacheKey(dataUrl);
      const cached = memCache.get(key);
      if (cached) {
        buf = cached;
      } else {
        buf = dataUrlToArrayBuffer(dataUrl);
        memCache.set(key, buf);
      }
    } catch (err) {
      if (pendingRef.current !== dataUrl) return;
      setError(String(err));
      setStatus("error");
      return;
    }

    /** Stage 2: extract plain text and display */
    const fallback = (renderErr: unknown) => {
      if (pendingRef.current !== dataUrl) return;
      try {
        const text = xmlToPlainText(readDocumentXml(buf));
        setPlainText(text);
        setStatus("fallback");
      } catch {
        // Both stages failed — show original render error
        setError(String(renderErr));
        setStatus("error");
      }
    };

    /** Stage 1: full DOCX rendering via docx-preview-sync */
    try {
      void renderAsync(buf.slice(0), container, styleRef.current ?? undefined, {
        inWrapper: false,
        ignoreHeight: true,
        ignoreWidth: true,
      })
        .then(() => {
          if (pendingRef.current !== dataUrl) return;
          setStatus("done");
        })
        .catch(fallback);
    } catch (err) {
      fallback(err);
    }
  }, [dataUrl]);

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-y-auto bg-white", className)}>
      <div ref={styleRef} />

      {/* Stage 1 success: rich rendered HTML */}
      <div
        ref={containerRef}
        className="p-2"
        style={{ visibility: status === "done" ? "visible" : "hidden" }}
      />

      {/* Stage 2 fallback: plain text */}
      {status === "fallback" && (
        <div className="p-6">
          <p className="mb-3 text-[11px] text-muted-foreground">
            {t("preview.docxFallback", "无法完整渲染此文档，以纯文本显示")}
          </p>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
            {plainText}
          </pre>
        </div>
      )}

      {/* Error: both stages failed */}
      {status === "error" && (
        <div className="p-4 text-sm text-destructive">{error}</div>
      )}

      {/* Loading spinner */}
      {status === "rendering" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
          <svg
            className="size-8 animate-spin text-muted-foreground/50"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <p className="text-sm text-muted-foreground">{t("preview.loading")}</p>
        </div>
      )}
    </div>
  );
}
