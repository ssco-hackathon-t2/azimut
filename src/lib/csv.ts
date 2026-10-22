/** Tabelle als CSV (Semikolon, Dezimalpunkt, UTF-8 mit BOM für Excel). Reine Serialisierung. */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  // Vereinigung aller Spalten, damit optionale Felder einzelner Zeilen nicht verloren gehen.
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(";"), ...rows.map((r) => cols.map((c) => cell(r[c])).join(";"))].join("\r\n");
}
