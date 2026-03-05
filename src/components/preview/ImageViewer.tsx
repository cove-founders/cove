import { useCallback, useEffect, useRef } from "react";
import { Minus, Plus, Maximize } from "lucide-react";
import { useImageZoomPan } from "@/hooks/useImageZoomPan";

interface ImageViewerProps {
  src: string;
  alt?: string;
}

export function ImageViewer({ src, alt }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoom = useImageZoomPan();

  const computeFitScale = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth) return;
    const sx = container.clientWidth / img.naturalWidth;
    const sy = container.clientHeight / img.naturalHeight;
    const fs = Math.min(sx, sy, 1);
    zoom.setFitScale(fs);
    zoom.reset(fs);
  }, [zoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => computeFitScale());
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeFitScale]);

  const pct = Math.round(zoom.scale * 100);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 cursor-grab items-center justify-center overflow-hidden bg-background-secondary"
        onWheel={zoom.onWheel}
        onMouseDown={zoom.onMouseDown}
        onMouseMove={zoom.onMouseMove}
        onMouseUp={zoom.onMouseUp}
        onMouseLeave={zoom.onMouseUp}
        onDoubleClick={zoom.onDoubleClick}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={computeFitScale}
          className="pointer-events-none max-w-none select-none"
          style={{
            transform: `translate(${zoom.translateX}px, ${zoom.translateY}px) scale(${zoom.scale})`,
            transformOrigin: "0 0",
          }}
        />
      </div>

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background/90 px-2 py-1 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={zoom.zoomOut}
          className="rounded-md p-1 text-muted-foreground hover:bg-background-tertiary hover:text-foreground"
          title="Zoom out"
        >
          <Minus className="size-3.5" strokeWidth={1.5} />
        </button>
        <span className="min-w-[40px] text-center text-[11px] text-foreground-secondary">
          {pct}%
        </span>
        <button
          type="button"
          onClick={zoom.zoomIn}
          className="rounded-md p-1 text-muted-foreground hover:bg-background-tertiary hover:text-foreground"
          title="Zoom in"
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={zoom.zoomToFit}
          className="rounded-md p-1 text-muted-foreground hover:bg-background-tertiary hover:text-foreground"
          title="Fit to window"
        >
          <Maximize className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
