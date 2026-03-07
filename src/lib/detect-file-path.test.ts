import { describe, expect, it } from "vitest";
import { detectPreviewableFilePath } from "./detect-file-path";

describe("detectPreviewableFilePath", () => {
  it("returns a previewable code file path unchanged", () => {
    expect(detectPreviewableFilePath("src/main.tsx")).toBe("src/main.tsx");
  });

  it("returns a TypeScript file path", () => {
    expect(detectPreviewableFilePath("src/lib/utils.ts")).toBe("src/lib/utils.ts");
  });

  it("accepts a relative path starting with ./", () => {
    expect(detectPreviewableFilePath("./src/index.ts")).toBe("./src/index.ts");
  });

  it("accepts a deep nested path", () => {
    expect(detectPreviewableFilePath("src/components/App.tsx")).toBe("src/components/App.tsx");
  });

  it("trims surrounding whitespace before matching", () => {
    expect(detectPreviewableFilePath("  src/main.tsx  ")).toBe("src/main.tsx");
  });

  it("returns null for unsupported file extension", () => {
    // .xyz is not in any supported extension set -> getPreviewKind returns 'unsupported'
    expect(detectPreviewableFilePath("src/file.xyz")).toBeNull();
  });

  it("returns null for bare filename without directory separator", () => {
    // FILE_PATH_PATTERN requires at least one directory segment
    expect(detectPreviewableFilePath("package.json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectPreviewableFilePath("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(detectPreviewableFilePath("   ")).toBeNull();
  });

  it("returns an image file path", () => {
    // .png -> getPreviewKind returns 'image', which is supported
    expect(detectPreviewableFilePath("assets/images/logo.png")).toBe("assets/images/logo.png");
  });

  it("returns a markdown file path", () => {
    expect(detectPreviewableFilePath("docs/README.md")).toBe("docs/README.md");
  });

  it("returns null for a plain word with no extension or separator", () => {
    expect(detectPreviewableFilePath("justAWord")).toBeNull();
  });
});
