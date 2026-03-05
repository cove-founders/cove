import { useEffect, useRef } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNum: number;
  width: number;
}

export function PdfPage({ doc, pageNum, width }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (width <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;

    doc
      .getPage(pageNum)
      .then((page) => {
        if (cancelled) {
          page.cleanup();
          return;
        }

        const baseVp = page.getViewport({ scale: 1 });
        const scale = width / baseVp.width;
        const vp = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(vp.width * dpr);
        canvas.height = Math.floor(vp.height * dpr);
        canvas.style.width = `${vp.width}px`;
        canvas.style.height = `${vp.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;
        ctx.scale(dpr, dpr);

        renderTask = page.render({ canvasContext: ctx, viewport: vp, canvas });
        return renderTask.promise.then(() => page.cleanup());
      })
      .catch(() => {
        // ignore cancel errors
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, pageNum, width]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        background: "#fff",
        borderRadius: 3,
        boxShadow: "0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)",
      }}
    />
  );
}
