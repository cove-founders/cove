import "katex/dist/katex.min.css";
import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";
import { invoke } from "@tauri-apps/api/core";
import { CodeBlock, reactNodeToDisplayString } from "./CodeBlock";
import { FileChip } from "./FileChip";

const remarkPlugins = [remarkGfm, remarkBreaks, remarkMath];
const rehypePluginsBase = [rehypeKatex];

/**
 * react-markdown v10 默认只允许 http/https/mailto/tel 协议，会把 file:// strip 成空字符串。
 * 加白名单保留 file://，其余仍走默认安全过滤。
 */
function urlTransform(url: string): string {
  if (url.startsWith("file://")) return url;
  return defaultUrlTransform(url);
}

function normalizePath(path: string): string {
  const parts = path.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      normalized.pop();
    } else if (part !== "." && part !== "") {
      normalized.push(part);
    }
  }
  return (path.startsWith("/") ? "/" : "") + normalized.join("/");
}

/**
 * Load an image referenced in a markdown file via Tauri IPC.
 *
 * Routing is based on the *previewed file's* context — not the image src:
 * - If the previewed file is inside the workspace, ALL images are loaded
 *   through the workspace-gated `read_file_as_data_url`. Absolute src
 *   pointing outside the workspace is rejected (prevents exfiltration).
 * - If the previewed file is outside the workspace (absolute path preview),
 *   images are resolved against basePath and loaded via
 *   `read_absolute_file_as_data_url`.
 */
function loadImageDataUrl(
  src: string,
  basePath: string,
  workspaceRoot?: string,
): Promise<string> {
  const insideWorkspace = workspaceRoot &&
    (basePath === workspaceRoot || basePath.startsWith(workspaceRoot + "/"));

  if (insideWorkspace) {
    let relativePath: string;
    if (src.startsWith("/")) {
      if (!src.startsWith(workspaceRoot + "/") && src !== workspaceRoot) {
        return Promise.reject(new Error("Image path outside workspace"));
      }
      relativePath = src.slice(workspaceRoot.length).replace(/^\//, "");
    } else {
      const dirRelative = basePath.slice(workspaceRoot.length).replace(/^\//, "");
      relativePath = normalizePath((dirRelative ? dirRelative + "/" : "") + src);
    }
    return invoke<{ dataUrl: string }>("read_file_as_data_url", {
      args: { workspaceRoot, path: relativePath },
    }).then((r) => r.dataUrl);
  }

  // Previewed file is outside workspace — resolve to absolute path
  const absPath = src.startsWith("/") ? src : normalizePath(basePath + "/" + src);
  return invoke<{ dataUrl: string }>("read_absolute_file_as_data_url", {
    args: { path: absPath },
  }).then((r) => r.dataUrl);
}

function LocalImage({
  src, alt, basePath, workspaceRoot,
}: {
  src: string; alt: string; basePath?: string; workspaceRoot?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src || basePath === undefined) return;
    let stale = false;
    setDataUrl(null);
    setError(false);
    loadImageDataUrl(src, basePath, workspaceRoot)
      .then((url) => { if (!stale) setDataUrl(url); })
      .catch(() => { if (!stale) setError(true); });
    return () => { stale = true; };
  }, [src, basePath, workspaceRoot]);

  if (error) return <span title={src}>[image: {src}]</span>;
  if (!dataUrl) return null;
  return <img src={dataUrl} alt={alt} className="max-w-full rounded" loading="lazy" />;
}

/**
 * Compute the absolute base directory for resolving relative image paths in a
 * markdown file. Returns `undefined` when resolution is not possible (no
 * workspace root for a relative path).
 */
export function computeMarkdownBasePath(
  filePath: string,
  workspaceRoot: string | null,
): string | undefined {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  if (filePath.startsWith("/")) return dir;
  if (!workspaceRoot) return undefined;
  return dir ? workspaceRoot + "/" + dir : workspaceRoot;
}

function createMarkdownComponents(basePath?: string, workspaceRoot?: string): Components {
  return {
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    h1: ({ children }) => <h1 className="mb-2 mt-4 text-xl font-semibold">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 mt-3 text-lg font-semibold">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1.5 mt-2 text-base font-semibold">{children}</h3>,
    ul: ({ children }) => <ul className="mb-2 list-disc pl-6 [&>li]:my-1">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 list-decimal pl-6 [&>li]:my-1">{children}</ol>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-border pl-3 my-2 text-muted-foreground">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-background-tertiary">{children}</thead>,
    th: ({ children }) => (
      <th className="border border-border px-2 py-1.5 text-left font-medium">{children}</th>
    ),
    td: ({ children }) => <td className="border border-border px-2 py-1.5">{children}</td>,
    tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
    pre: CodeBlock as unknown as Components["pre"],
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      const safeChildren =
        typeof children === "string" ? children : reactNodeToDisplayString(children ?? "");
      if (isInline) {
        return (
          <code
            className="rounded bg-background-tertiary px-1 py-0.5 font-mono text-[13px]"
            {...props}
          >
            {safeChildren}
          </code>
        );
      }
      return <code {...props}>{safeChildren}</code>;
    },
    img: ({ src, alt }) => {
      if (!src) return null;
      if (/^(https?:\/\/|data:|#)/.test(src)) {
        return <img src={src} alt={alt ?? ""} className="max-w-full rounded" loading="lazy" />;
      }
      if (basePath === undefined) {
        return <img src={src} alt={alt ?? ""} className="max-w-full rounded" loading="lazy" />;
      }
      return <LocalImage src={src} alt={alt ?? ""} basePath={basePath} workspaceRoot={workspaceRoot} />;
    },
    a: ({ href, children }) => {
      if (href?.startsWith("file://")) {
        const filePath = decodeURIComponent(href.replace(/^file:\/\//, ""));
        const displayName =
          typeof children === "string"
            ? children
            : reactNodeToDisplayString(children ?? "");
        const name = displayName || filePath.split("/").pop() || filePath;
        return <FileChip path={filePath} name={name} />;
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          {children}
        </a>
      );
    },
    span: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
      if (className?.includes("streaming-cursor-placeholder")) {
        return (
          <span className="cursor-blink ml-0.5 inline-block h-4 w-0.5 bg-brand align-middle" aria-hidden />
        );
      }
      return <span className={className} {...props}>{children}</span>;
    },
  };
}

export interface MarkdownContentProps {
  source: string;
  className?: string;
  /** 流式时在文末渲染打字机光标（紧跟文字） */
  trailingCursor?: boolean;
  /** Directory containing the markdown file, used to resolve relative image paths */
  basePath?: string;
  /** Workspace root for workspace-gated file access */
  workspaceRoot?: string;
}

/**
 * Memoized markdown renderer for the "settled" portion (complete lines).
 * Only re-parses when the settled text actually changes — i.e. when a new
 * `\n` enters the typewriter output — not on every frame.
 */
const SettledMarkdown = React.memo(function SettledMarkdown({
  source,
  basePath,
  workspaceRoot,
}: {
  source: string;
  basePath?: string;
  workspaceRoot?: string;
}) {
  const components = useMemo(() => createMarkdownComponents(basePath, workspaceRoot), [basePath, workspaceRoot]);
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePluginsBase}
      components={components}
      urlTransform={urlTransform}
      skipHtml
    >
      {source}
    </ReactMarkdown>
  );
});

const CURSOR_EL = (
  <span
    className="cursor-blink ml-0.5 inline-block h-4 w-0.5 bg-brand align-middle"
    aria-hidden
  />
);

/**
 * 某些模型会把 markdown 强调符转义成 \*\*text\*\*，导致前端显示字面量 **。
 * 这里做一层保守修正：仅在"非代码块"文本中恢复常见强调标记。
 */
function normalizeEscapedMarkdown(source: string): string {
  if (!source) return source;
  // 包含 fenced code 时不做修正，避免改坏代码片段
  if (source.includes("```")) return source;
  return source
    .replace(/\\\*\\\*(.+?)\\\*\\\*/g, "**$1**")
    .replace(/\\\*(.+?)\\\*/g, "*$1*");
}

/**
 * 防御性处理：把明显非法的 HTML 标签（如 <54>）转义为纯文本，
 * 避免 React 创建元素时抛出 InvalidCharacterError。
 */
function sanitizeInvalidHtmlLikeTags(source: string): string {
  if (!source) return source;
  return source.replace(/<\s*\/?\s*([0-9][^>]*)>/g, (_, inner: string) => `&lt;${inner}&gt;`);
}

import { cn } from "@/lib/utils";

export function MarkdownContent({ source, className, trailingCursor, basePath, workspaceRoot }: MarkdownContentProps) {
  const normalizedSource = sanitizeInvalidHtmlLikeTags(normalizeEscapedMarkdown(source));
  const hasVisibleContent = normalizedSource.trim().length > 0;

  useEffect(() => {
    if (!hasVisibleContent) return;
    if (!import.meta.env.DEV) return;
    if (source !== normalizedSource) {
      console.debug("[MarkdownContent] 检测到转义 markdown，已标准化", {
        sourcePreview: source.slice(0, 160),
        normalizedPreview: normalizedSource.slice(0, 160),
        trailingCursor: !!trailingCursor,
      });
    }
    if (/<\s*[0-9][^>]*>/.test(source)) {
      console.warn("[MarkdownContent] 检测到疑似非法 HTML 标签，已转义处理", {
        sourcePreview: source.slice(0, 160),
      });
    }
  }, [hasVisibleContent, source, normalizedSource, trailingCursor]);

  const mdComponents = useMemo(() => createMarkdownComponents(basePath, workspaceRoot), [basePath, workspaceRoot]);

  if (!hasVisibleContent) return null;

  const wrapperCls = cn(
    "markdown-body mb-4 text-[14px] leading-relaxed select-text",
    className,
  );

  /*
   * Streaming mode (trailingCursor): split content into two layers.
   *
   * 1. **Settled** — everything up to the last `\n`. Rendered with full
   *    Markdown. Only re-parses when a new line completes → huge perf win.
   * 2. **Pending** — the current partial line. Rendered as plain text so
   *    the user sees a smooth character-by-character typewriter and never
   *    encounters broken markdown syntax (unclosed `**`, partial ```).
   *
   * 当首行尚未出现 `\n` 时，优先纯文本渲染，避免高频全量 markdown parse。
   */
  if (trailingCursor) {
    const lastNl = normalizedSource.lastIndexOf("\n");

    if (lastNl >= 0) {
      const settled = normalizedSource.slice(0, lastNl + 1);
      const pending = normalizedSource.slice(lastNl + 1);

      return (
        <div className={wrapperCls} data-md>
          <SettledMarkdown source={settled} basePath={basePath} workspaceRoot={workspaceRoot} />
          {pending ? (
            <p className="mb-0 last:mb-0">
              {pending}
              {CURSOR_EL}
            </p>
          ) : (
            CURSOR_EL
          )}
        </div>
      );
    }

    // 还没有换行时，先按纯文本渲染，避免每个字符都触发完整 Markdown 解析导致卡顿
    return (
      <div className={wrapperCls} data-md>
        <p className="mb-0 last:mb-0 whitespace-pre-wrap break-words">
          {normalizedSource}
          {CURSOR_EL}
        </p>
      </div>
    );
  }

  // Not streaming — render everything with full markdown
  return (
    <div className={wrapperCls} data-md>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePluginsBase}
        components={mdComponents}
        urlTransform={urlTransform}
        skipHtml
      >
        {normalizedSource}
      </ReactMarkdown>
    </div>
  );
}

export type { ThinkBlock } from "@/lib/splitThinkBlocks";
export { splitThinkBlocks } from "@/lib/splitThinkBlocks";
