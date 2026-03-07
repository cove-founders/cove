/**
 * Generate a duplicate file name: foo.txt -> foo (copy).txt
 * Handles existing copy suffixes: foo (copy).txt -> foo (copy 2).txt
 */
export function getDuplicateName(fileName: string): string {
  const dotIdx = fileName.lastIndexOf(".");
  const hasExt = dotIdx > 0; // dotIdx === 0 means dotfile like .gitignore
  const ext = hasExt ? fileName.slice(dotIdx) : "";
  const base = hasExt ? fileName.slice(0, dotIdx) : fileName;
  const copyMatch = base.match(/^(.+?) \(copy(?: (\d+))?\)$/);
  if (copyMatch) {
    const origBase = copyMatch[1]!;
    const num = copyMatch[2] ? parseInt(copyMatch[2], 10) + 1 : 2;
    return `${origBase} (copy ${num})${ext}`;
  }
  return `${base} (copy)${ext}`;
}
