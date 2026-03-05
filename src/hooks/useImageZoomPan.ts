import { useCallback, useRef, useState } from "react";
import type { MouseEvent, WheelEvent } from "react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_FACTOR = 0.1;

interface ZoomPanState {
  scale: number;
  translateX: number;
  translateY: number;
}

export function useImageZoomPan() {
  const [state, setState] = useState<ZoomPanState>({ scale: 1, translateX: 0, translateY: 0 });
  const [fitScale, setFitScale] = useState(1);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const reset = useCallback((newFitScale?: number) => {
    const fs = newFitScale ?? fitScale;
    setFitScale(fs);
    setState({ scale: fs, translateX: 0, translateY: 0 });
  }, [fitScale]);

  const onWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    setState((prev) => {
      const direction = e.deltaY < 0 ? 1 : -1;
      const newScale = clampScale(prev.scale * (1 + direction * ZOOM_FACTOR));
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        translateX: cursorX - ratio * (cursorX - prev.translateX),
        translateY: cursorY - ratio * (cursorY - prev.translateY),
      };
    });
  }, []);

  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = "grabbing";
  }, []);

  const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setState((prev) => ({
      ...prev,
      translateX: prev.translateX + dx,
      translateY: prev.translateY + dy,
    }));
  }, []);

  const onMouseUp = useCallback((e: MouseEvent<HTMLDivElement>) => {
    dragging.current = false;
    e.currentTarget.style.cursor = "grab";
  }, []);

  const onDoubleClick = useCallback(() => {
    setState((prev) => {
      if (Math.abs(prev.scale - fitScale) < 0.01) {
        return { scale: 1, translateX: 0, translateY: 0 };
      }
      return { scale: fitScale, translateX: 0, translateY: 0 };
    });
  }, [fitScale]);

  const zoomIn = useCallback(() => {
    setState((prev) => ({ ...prev, scale: clampScale(prev.scale * 1.2) }));
  }, []);

  const zoomOut = useCallback(() => {
    setState((prev) => ({ ...prev, scale: clampScale(prev.scale / 1.2) }));
  }, []);

  const zoomToFit = useCallback(() => {
    setState({ scale: fitScale, translateX: 0, translateY: 0 });
  }, [fitScale]);

  return {
    ...state,
    fitScale,
    setFitScale,
    reset,
    onWheel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick,
    zoomIn,
    zoomOut,
    zoomToFit,
  };
}
