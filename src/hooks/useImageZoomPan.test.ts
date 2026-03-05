// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageZoomPan } from "./useImageZoomPan";

describe("useImageZoomPan", () => {
  describe("initial state", () => {
    it("starts with scale=1, translateX=0, translateY=0", () => {
      const { result } = renderHook(() => useImageZoomPan());
      expect(result.current.scale).toBe(1);
      expect(result.current.translateX).toBe(0);
      expect(result.current.translateY).toBe(0);
    });

    it("starts with fitScale=1", () => {
      const { result } = renderHook(() => useImageZoomPan());
      expect(result.current.fitScale).toBe(1);
    });
  });

  describe("zoomIn", () => {
    it("increases scale by factor of 1.2", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.zoomIn());
      expect(result.current.scale).toBeCloseTo(1.2, 5);
    });

    it("increases scale on subsequent calls", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.zoomIn());
      act(() => result.current.zoomIn());
      expect(result.current.scale).toBeCloseTo(1.44, 5);
    });

    it("does not exceed MAX_SCALE of 10", () => {
      const { result } = renderHook(() => useImageZoomPan());
      // Zoom in many times to hit the max
      for (let i = 0; i < 50; i++) {
        act(() => result.current.zoomIn());
      }
      expect(result.current.scale).toBeLessThanOrEqual(10);
    });
  });

  describe("zoomOut", () => {
    it("decreases scale by dividing by 1.2", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.zoomOut());
      expect(result.current.scale).toBeCloseTo(1 / 1.2, 5);
    });

    it("does not go below MIN_SCALE of 0.1", () => {
      const { result } = renderHook(() => useImageZoomPan());
      // Zoom out many times to hit the min
      for (let i = 0; i < 50; i++) {
        act(() => result.current.zoomOut());
      }
      expect(result.current.scale).toBeGreaterThanOrEqual(0.1);
    });

    it("decreases scale on subsequent calls", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.zoomOut());
      const afterFirst = result.current.scale;
      act(() => result.current.zoomOut());
      expect(result.current.scale).toBeLessThan(afterFirst);
    });
  });

  describe("zoomToFit", () => {
    it("sets scale to fitScale", () => {
      const { result } = renderHook(() => useImageZoomPan());
      // First zoom in to change scale away from fitScale
      act(() => result.current.zoomIn());
      expect(result.current.scale).toBeCloseTo(1.2, 5);

      // zoomToFit should restore to fitScale (default 1)
      act(() => result.current.zoomToFit());
      expect(result.current.scale).toBe(result.current.fitScale);
    });

    it("resets translation to 0,0", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.zoomIn());
      act(() => result.current.zoomToFit());
      expect(result.current.translateX).toBe(0);
      expect(result.current.translateY).toBe(0);
    });

    it("uses updated fitScale after setFitScale", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.setFitScale(0.5));
      act(() => result.current.zoomToFit());
      expect(result.current.scale).toBe(0.5);
    });
  });

  describe("reset", () => {
    it("resets scale and translate to fitScale and 0,0", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.zoomIn());
      act(() => result.current.reset());
      expect(result.current.scale).toBe(result.current.fitScale);
      expect(result.current.translateX).toBe(0);
      expect(result.current.translateY).toBe(0);
    });

    it("reset with explicit newFitScale updates fitScale", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.reset(0.75));
      expect(result.current.fitScale).toBe(0.75);
      expect(result.current.scale).toBe(0.75);
      expect(result.current.translateX).toBe(0);
      expect(result.current.translateY).toBe(0);
    });

    it("reset without argument uses current fitScale", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.setFitScale(0.6));
      act(() => result.current.zoomIn());
      act(() => result.current.reset());
      expect(result.current.scale).toBe(0.6);
    });
  });

  describe("scale clamping", () => {
    it("scale never goes below 0.1 after many zoom-outs", () => {
      const { result } = renderHook(() => useImageZoomPan());
      for (let i = 0; i < 100; i++) {
        act(() => result.current.zoomOut());
      }
      expect(result.current.scale).toBeGreaterThanOrEqual(0.1);
    });

    it("scale never exceeds 10 after many zoom-ins", () => {
      const { result } = renderHook(() => useImageZoomPan());
      for (let i = 0; i < 100; i++) {
        act(() => result.current.zoomIn());
      }
      expect(result.current.scale).toBeLessThanOrEqual(10);
    });

    it("scale is exactly 0.1 at minimum boundary", () => {
      const { result } = renderHook(() => useImageZoomPan());
      for (let i = 0; i < 200; i++) {
        act(() => result.current.zoomOut());
      }
      expect(result.current.scale).toBe(0.1);
    });

    it("scale is exactly 10 at maximum boundary", () => {
      const { result } = renderHook(() => useImageZoomPan());
      for (let i = 0; i < 200; i++) {
        act(() => result.current.zoomIn());
      }
      expect(result.current.scale).toBe(10);
    });
  });

  describe("setFitScale", () => {
    it("updates fitScale", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.setFitScale(0.8));
      expect(result.current.fitScale).toBe(0.8);
    });

    it("does not immediately change scale", () => {
      const { result } = renderHook(() => useImageZoomPan());
      act(() => result.current.setFitScale(0.3));
      // scale is unchanged until reset/zoomToFit is called
      expect(result.current.scale).toBe(1);
    });
  });

  describe("handler presence", () => {
    it("exposes expected handler functions", () => {
      const { result } = renderHook(() => useImageZoomPan());
      expect(typeof result.current.onWheel).toBe("function");
      expect(typeof result.current.onMouseDown).toBe("function");
      expect(typeof result.current.onMouseMove).toBe("function");
      expect(typeof result.current.onMouseUp).toBe("function");
      expect(typeof result.current.onDoubleClick).toBe("function");
    });
  });
});
