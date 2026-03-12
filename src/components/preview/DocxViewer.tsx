/**
 * DocxViewer — renders DOCX documents using docx-preview.
 *
 * Uses inWrapper:false so content flows directly into the panel (no page
 * card frame, no gray background). Container padding provides the margins.
 *
 * Cache strategy:
 *   L1 in-memory (module Map): zero-latency within the same session.
 */
import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { cn } from "@/lib/utils";

// ── L1 in-memory cache ─────────────────────────────────────────────────────
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

interface DocxViewerProps {
  dataUrl: string;
  className?: string;
  /** Called when rendering fails so the parent can show a fallback UI. */
  onRenderError?: (err: string) => void;
}

type Status = "idle" | "rendering" | "done" | "error";

export function DocxViewer({ dataUrl, className, onRenderError }: DocxViewerProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string>("");

  useEffect(() => {
    if (!dataUrl) return;

    pendingRef.current = dataUrl;
    setStatus("rendering");
    setError("");

    const key = cacheKey(dataUrl);
    let buf = memCache.get(key);
    if (!buf) {
      buf = dataUrlToArrayBuffer(dataUrl);
      memCache.set(key, buf);
    }

    const container = containerRef.current;
    if (!container) return;

    // Clear previous render before loading a new file
    container.innerHTML = "";

    // Wrap in Promise.resolve() so any synchronous throw from renderAsync is
    // also caught by .catch() — not just async rejections.
    Promise.resolve()
      .then(() =>
        renderAsync(buf, container, styleRef.current ?? undefined, {
          className: "docx",
          inWrapper: false,
          // Let content fill the container width; padding on the outer div
          // provides the left/right margins.
          ignoreWidth: true,
          ignoreHeight: false,
          breakPages: false,
          useBase64URL: true,
        }),
      )
      .then(() => {
        if (pendingRef.current !== dataUrl) return;
        setStatus("done");
      })
      .catch((err: unknown) => {
        if (pendingRef.current !== dataUrl) return;
        const msg = String(err);
        setError(msg);
        setStatus("error");
        onRenderError?.(msg);
      });
  }, [dataUrl]);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-background",
        className,
      )}
    >
      {/* docx-preview injects its stylesheet here */}
      <div ref={styleRef} />

      {/* Loading overlay */}
      {status !== "done" && status !== "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background">
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
          <p className="text-sm text-muted-foreground">正在加载文档…</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* docx-preview renders content into this div.
          px-10 py-8 provides the document left/right/top/bottom margins. */}
      <div
        ref={containerRef}
        className="px-10 py-8"
        style={{ visibility: status === "done" ? "visible" : "hidden" }}
      />
    </div>
  );
}
