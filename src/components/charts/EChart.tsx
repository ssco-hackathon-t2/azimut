"use client";

import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, ScatterChart, CustomChart, HeatmapChart } from "echarts/charts";
import {
  VisualMapComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";
import { buildTheme } from "./theme";

const THEME = "polarnacht";

// Modulare Imports: nur die verwendeten Diagrammtypen landen im Bundle.
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  CustomChart,
  HeatmapChart,
  VisualMapComponent,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  MarkPointComponent,
  CanvasRenderer,
]);

export { CHART, alpha, seriesColors } from "./theme";

// Theme einmal im Browser registrieren, sobald die CSS-Tokens lesbar sind.
let themed = false;
function ensureTheme() {
  if (themed) return;
  echarts.registerTheme(THEME, buildTheme());
  themed = true;
}

const deNum = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

/** Wertachse mit deutschem Zahlformat (ECharts nutzt sonst „1,500“). Optik kommt aus dem Theme. */
export function valueAxis(extra: Record<string, unknown> = {}) {
  return { ...extra, axisLabel: { formatter: (v: number) => deNum.format(v), ...((extra.axisLabel as object) ?? {}) } };
}

/** Schmale Ansicht (Handy): Diagramme reduzieren Beschriftungen statt sie zu stapeln. */
export function useNarrow(max = 640) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [max]);
  return narrow;
}

interface Props {
  option: EChartsCoreOption;
  height: number | string;
  label: string;
  /** Zeigt „Ansicht zurücksetzen“, wenn das Diagramm Zoom anbietet. */
  zoomable?: boolean;
  className?: string;
  onReady?: (chart: echarts.ECharts) => void;
}

export function EChart({ option, height, label, zoomable = false, className = "", onReady }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!el.current) return;
    ensureTheme();
    const c = echarts.init(el.current, THEME, { renderer: "canvas" });
    chart.current = c;
    c.on("datazoom", () => {
      const dz = (c.getOption().dataZoom as { start?: number; end?: number }[] | undefined) ?? [];
      setZoomed(dz.some((z) => (z.start ?? 0) > 0.01 || (z.end ?? 100) < 99.99));
    });
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    onReady?.(c);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
    // onReady bewusst nur beim Erzeugen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Erst zeichnen, wenn das Diagramm sichtbar wird: so baut es sich beim Ankommen im Kapitel auf (einmalig).
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el.current || typeof IntersectionObserver === "undefined") return setSeen(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.current?.setOption({ ...option, animation: reduce ? false : (option as { animation?: boolean }).animation ?? true }, { notMerge: true });
  }, [option, seen]);

  const reset = () => {
    chart.current?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
    setZoomed(false);
  };

  return (
    <div className={className}>
      {zoomable && (
        <div className="mb-2 flex items-center justify-end gap-3 text-[0.8rem] text-mist">
          <span className="hidden sm:inline">Zoomen mit Mausrad oder zwei Fingern</span>
          <button
            type="button"
            onClick={reset}
            disabled={!zoomed}
            className="border border-rule-strong px-2.5 py-1 text-snow transition-opacity disabled:cursor-default disabled:opacity-40"
          >
            Ansicht zurücksetzen
          </button>
        </div>
      )}
      <div ref={el} role="img" aria-label={label} style={{ height, width: "100%" }} />
    </div>
  );
}
