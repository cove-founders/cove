import { getPreviewKind } from "@/lib/preview-types";

/**
 * File-path pattern for inline code detection in assistant markdown.
 * Matches:
 * - Absolute paths starting with /
 * - Relative paths with at least one directory separator (src/main.tsx, ./foo/bar.ts)
 *
 * Must have a file extension to avoid false positives on arbitrary text.
 */
const FILE_PATH_PATTERN = /^(?:\.{0,2}\/)?(?:[\w.@-]+\/)+[\w.-]+\.\w+$/;

/**
 * Check if an inline code string looks like a file path that we can preview.
 * Returns the path string if previewable, null otherwise.
 */
export function detectPreviewableFilePath(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!FILE_PATH_PATTERN.test(trimmed)) return null;
  const kind = getPreviewKind(trimmed);
  if (kind === "unsupported") return null;
  return trimmed;
}
