// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("katex/dist/katex.min.css", () => ({}));

// Use a component mock that renders img tags so we can test image resolution
vi.mock("react-markdown", () => ({
  default: ({ children, components }: { children: string; components?: Record<string, unknown> }) => {
    // If components.img exists and source contains markdown image syntax, render through it
    const imgMatch = children?.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch && components?.img) {
      const ImgComponent = components.img as React.FC<{ src: string; alt: string }>;
      return <div><ImgComponent src={imgMatch[2]} alt={imgMatch[1]} /></div>;
    }
    return <p>{children}</p>;
  },
}));
vi.mock("remark-gfm", () => ({ default: () => {} }));
vi.mock("remark-breaks", () => ({ default: () => {} }));
vi.mock("remark-math", () => ({ default: () => {} }));
vi.mock("rehype-katex", () => ({ default: () => {} }));
vi.mock("./CodeBlock", () => ({
  CodeBlock: ({ children }: { children: React.ReactNode }) => <pre>{children}</pre>,
  reactNodeToDisplayString: (n: unknown) => String(n),
}));
vi.mock("@/lib/detect-file-path", () => ({
  detectPreviewableFilePath: () => null,
}));
vi.mock("@/lib/resolve-file-paths", () => ({
  resolveFilePathsFromContext: (s: string) => s,
}));
vi.mock("@/components/common/FilePathChip", () => ({
  FilePathChip: ({ path }: { path: string }) => <span>{path}</span>,
}));

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

import { MarkdownContent, computeMarkdownBasePath } from "./MarkdownContent";

beforeEach(() => {
  mockInvoke.mockReset();
});

const LONG_URL = "https://example.com/" + "a".repeat(400);

describe("MarkdownContent overflow prevention", () => {
  it("wrapper has break-words class for normal render", () => {
    const { container } = render(<MarkdownContent source="hello world" />);
    const wrapper = container.querySelector("[data-md]");
    expect(wrapper).toBeTruthy();
    expect(wrapper!.className).toContain("break-words");
  });

  it("wrapper has break-words when rendering long unbroken text", () => {
    const { container } = render(<MarkdownContent source={LONG_URL} />);
    const wrapper = container.querySelector("[data-md]");
    expect(wrapper!.className).toContain("break-words");
  });

  it("streaming pending line has break-words", () => {
    const source = "settled line\npending-text-here";
    const { container } = render(
      <MarkdownContent source={source} trailingCursor />,
    );
    const paragraphs = container.querySelectorAll("p");
    const pendingP = Array.from(paragraphs).find((p) =>
      p.textContent?.includes("pending-text-here"),
    );
    expect(pendingP).toBeTruthy();
    expect(pendingP!.className).toContain("break-words");
  });

  it("streaming first-line (no newline yet) has break-words", () => {
    const { container } = render(
      <MarkdownContent source="no-newline-yet" trailingCursor />,
    );
    const p = container.querySelector("p");
    expect(p).toBeTruthy();
    expect(p!.className).toContain("break-words");
  });

  it("returns null for empty/whitespace source", () => {
    const { container } = render(<MarkdownContent source="   " />);
    expect(container.querySelector("[data-md]")).toBeNull();
  });
});

describe("computeMarkdownBasePath", () => {
  it("returns directory for absolute path", () => {
    expect(computeMarkdownBasePath("/Users/me/docs/README.md", null)).toBe("/Users/me/docs");
  });

  it("returns directory for absolute path ignoring workspaceRoot", () => {
    expect(computeMarkdownBasePath("/Users/me/docs/guide.md", "/workspace")).toBe("/Users/me/docs");
  });

  it("returns workspaceRoot for root-level relative path (README.md)", () => {
    expect(computeMarkdownBasePath("README.md", "/workspace")).toBe("/workspace");
  });

  it("returns workspaceRoot + dir for nested relative path", () => {
    expect(computeMarkdownBasePath("docs/guide.md", "/workspace")).toBe("/workspace/docs");
  });

  it("returns undefined when relative path and no workspaceRoot", () => {
    expect(computeMarkdownBasePath("docs/guide.md", null)).toBeUndefined();
  });

  it("handles deeply nested relative path", () => {
    expect(computeMarkdownBasePath("a/b/c/file.md", "/ws")).toBe("/ws/a/b/c");
  });
});

describe("image resolution security", () => {
  it("workspace file with relative image uses workspace-gated command", async () => {
    mockInvoke.mockResolvedValue({ dataUrl: "data:image/png;base64,abc" });
    render(
      <MarkdownContent
        source="![photo](img.png)"
        basePath="/workspace/docs"
        workspaceRoot="/workspace"
      />,
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("read_file_as_data_url", {
        args: { workspaceRoot: "/workspace", path: "docs/img.png" },
      });
    });
  });

  it("workspace file with absolute image outside workspace is rejected", async () => {
    mockInvoke.mockResolvedValue({ dataUrl: "data:image/png;base64,abc" });
    render(
      <MarkdownContent
        source="![evil](/etc/hosts)"
        basePath="/workspace/docs"
        workspaceRoot="/workspace"
      />,
    );
    // Should NOT call any invoke for /etc/hosts
    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "read_absolute_file_as_data_url",
      expect.anything(),
    );
  });

  it("absolute file outside workspace with relative image uses read_absolute", async () => {
    mockInvoke.mockResolvedValue({ dataUrl: "data:image/png;base64,abc" });
    render(
      <MarkdownContent
        source="![photo](foo.png)"
        basePath="/Users/me/docs"
        workspaceRoot="/workspace"
      />,
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("read_absolute_file_as_data_url", {
        args: { path: "/Users/me/docs/foo.png" },
      });
    });
  });

  it("sibling-prefix path is NOT treated as inside workspace", async () => {
    mockInvoke.mockResolvedValue({ dataUrl: "data:image/png;base64,abc" });
    render(
      <MarkdownContent
        source="![img](photo.png)"
        basePath="/Users/me/code/cove-docs"
        workspaceRoot="/Users/me/code/cove"
      />,
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("read_absolute_file_as_data_url", {
        args: { path: "/Users/me/code/cove-docs/photo.png" },
      });
    });
  });

  it("workspace root-level README with relative image resolves correctly", async () => {
    mockInvoke.mockResolvedValue({ dataUrl: "data:image/png;base64,abc" });
    render(
      <MarkdownContent
        source="![logo](logo.png)"
        basePath="/workspace"
        workspaceRoot="/workspace"
      />,
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("read_file_as_data_url", {
        args: { workspaceRoot: "/workspace", path: "logo.png" },
      });
    });
  });
});
