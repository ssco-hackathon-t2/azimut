// Diagramm-Design aus den CSS-Tokens (globals.css). Einzige Quelle für Farben und Schriften: hier steht
// kein Farbwert, nur der Name der Variable. ECharts zeichnet auf Canvas und braucht echte Werte, deshalb
// werden die Variablen einmal im Browser gelesen.

const VARS = {
  ink: "--color-snow",
  mist: "--color-mist",
  mist2: "--color-mist-2",
  rule: "--color-rule",
  ruleStrong: "--color-rule-strong",
  surface: "--color-night-2",
  ice: "--color-ice",
  iceDeep: "--color-ice-deep",
  iceDim: "--color-ice-dim",
  aurora: "--color-aurora",
  amber: "--color-amber",
  alert: "--color-alert",
  deduct: "--chart-deduct",
  font: "--font-sans",
  mono: "--font-mono",
} as const;

type Token = keyof typeof VARS;

let cache: Record<Token, string> | null = null;
let series: string[] = [];

function tokens(): Record<Token, string> {
  if (cache) return cache;
  // Beim statischen Vorrendern gibt es kein document; Diagramme zeichnen erst im Browser.
  if (typeof document === "undefined") return Object.fromEntries(Object.keys(VARS).map((k) => [k, ""])) as Record<Token, string>;
  const cs = getComputedStyle(document.documentElement);
  cache = Object.fromEntries(Object.entries(VARS).map(([k, v]) => [k, cs.getPropertyValue(v).trim()])) as Record<Token, string>;
  series = cs.getPropertyValue("--chart-series").split(",").map((s) => s.trim()).filter(Boolean);
  return cache;
}

/** Farben und Schriften der Diagramme, z. B. `CHART.ice`. Werte kommen aus globals.css. */
export const CHART = Object.defineProperties(
  {},
  Object.fromEntries(Object.keys(VARS).map((k) => [k, { enumerable: true, get: () => tokens()[k as Token] }])),
) as Record<Token, string>;

/** Serienpalette für gruppierte Reihen (`--chart-series`). */
export function seriesColors(): string[] {
  tokens();
  return series;
}

/** Token-Farbe mit Deckkraft, z. B. `alpha(CHART.ice, 0.16)`. Canvas versteht kein color-mix(). */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** ECharts-Theme „polarnacht“: Grundoptik aller Diagramme. Einzeldiagramme setzen nur, was abweicht. */
export function buildTheme() {
  const t = tokens();
  const axis = {
    axisLine: { lineStyle: { color: t.ruleStrong } },
    axisTick: { lineStyle: { color: t.ruleStrong } },
    axisLabel: { color: t.mist, fontSize: 12 },
    splitLine: { lineStyle: { color: t.rule, opacity: 0.7 } },
    nameTextStyle: { color: t.mist, fontSize: 12 },
  };
  return {
    color: seriesColors(),
    backgroundColor: "transparent",
    textStyle: { fontFamily: t.font, color: t.mist, fontSize: 13 },
    animationDuration: 600,
    animationEasing: "cubicOut",
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.ruleStrong,
      textStyle: { color: t.ink, fontFamily: t.font, fontSize: 13 },
      confine: true,
      axisPointer: { lineStyle: { color: t.ruleStrong }, shadowStyle: { color: alpha(t.ice, 0.06) } },
    },
    legend: { textStyle: { color: t.mist, fontSize: 13 }, pageTextStyle: { color: t.mist }, icon: "roundRect", itemWidth: 14, itemHeight: 3 },
    categoryAxis: axis,
    valueAxis: axis,
    logAxis: axis,
    timeAxis: axis,
    dataZoom: {
      borderColor: t.rule,
      fillerColor: alpha(t.ice, 0.12),
      handleStyle: { color: t.ice },
      textStyle: { color: t.mist },
      dataBackground: { lineStyle: { color: t.ruleStrong }, areaStyle: { color: alpha(t.ice, 0.08) } },
    },
  };
}
