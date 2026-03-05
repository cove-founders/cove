// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ImageViewer } from "./ImageViewer";

// ResizeObserver is not available in happy-dom; provide a no-op stub.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ImageViewer", () => {
  describe("image rendering", () => {
    it("renders an img element with the supplied src", () => {
      render(<ImageViewer src="https://example.com/photo.png" />);
      const img = screen.getByRole("img") as HTMLImageElement;
      expect(img.src).toBe("https://example.com/photo.png");
    });

    it("renders alt text when provided", () => {
      render(<ImageViewer src="https://example.com/photo.png" alt="A sample photo" />);
      const img = screen.getByAltText("A sample photo");
      expect(img).toBeTruthy();
    });

    it("img has draggable=false to prevent browser drag", () => {
      render(<ImageViewer src="https://example.com/photo.png" />);
      const img = screen.getByRole("img") as HTMLImageElement;
      // draggable attribute is "false" (string) in the DOM
      expect(img.getAttribute("draggable")).toBe("false");
    });

    it("renders without alt when alt prop is omitted", () => {
      render(<ImageViewer src="https://example.com/photo.png" />);
      // img should still be present
      expect(screen.getByRole("img")).toBeTruthy();
    });
  });

  describe("zoom controls", () => {
    it("renders a zoom-out button with title 'Zoom out'", () => {
      render(<ImageViewer src="img.png" />);
      expect(screen.getByTitle("Zoom out")).toBeTruthy();
    });

    it("renders a zoom-in button with title 'Zoom in'", () => {
      render(<ImageViewer src="img.png" />);
      expect(screen.getByTitle("Zoom in")).toBeTruthy();
    });

    it("renders a fit-to-window button with title 'Fit to window'", () => {
      render(<ImageViewer src="img.png" />);
      expect(screen.getByTitle("Fit to window")).toBeTruthy();
    });

    it("renders three control buttons in the toolbar", () => {
      render(<ImageViewer src="img.png" />);
      const zoomOut = screen.getByTitle("Zoom out");
      const zoomIn = screen.getByTitle("Zoom in");
      const fit = screen.getByTitle("Fit to window");
      expect(zoomOut.tagName).toBe("BUTTON");
      expect(zoomIn.tagName).toBe("BUTTON");
      expect(fit.tagName).toBe("BUTTON");
    });
  });

  describe("zoom percentage display", () => {
    it("shows 100% zoom percentage on initial render", () => {
      render(<ImageViewer src="img.png" />);
      // The initial scale is 1, so 100%
      expect(screen.getByText("100%")).toBeTruthy();
    });

    it("zoom percentage is rendered as a text node", () => {
      render(<ImageViewer src="img.png" />);
      const pctEl = screen.getByText("100%");
      expect(pctEl.tagName).toBe("SPAN");
    });
  });
});
