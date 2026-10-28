// Reine Prüf- und Kostenschutz-Logik der Function azimut-chat (ohne Deno-APIs, testbar mit node --test).

export const MAX_INPUT_CHARS = 1000;
export const MAX_HISTORY = 8;
export const RATE_LIMIT = 20;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

export type ChatMessage = { role: "user" | "assistant"; content: string };

const ALLOWED_ORIGINS = ["https://ssco-hackathon-t2.github.io"];

/** Nur die GitHub-Pages-Seite und localhost (Tests, pnpm dev) dürfen die Function aufrufen. */
export function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * Verlauf aus dem Request prüfen und auf die letzten MAX_HISTORY Nachrichten kürzen.
 * Gibt einen Fehlertext zurück, wenn die Eingabe nicht passt.
 */
export function parseHistory(body: unknown): ChatMessage[] | string {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return "messages missing";
  const msgs: ChatMessage[] = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return "invalid message";
    const content = m.content.trim();
    // Assistenz-Antworten sind länger (max_tokens), dürfen aber nicht als Umweg für lange Eingaben dienen.
    if (content.length > (m.role === "user" ? MAX_INPUT_CHARS : 4 * MAX_INPUT_CHARS)) return "message too long";
    if (content) msgs.push({ role: m.role, content });
  }
  const last = msgs.at(-1);
  if (!last || last.role !== "user") return "last message must be from the user";
  const kept = msgs.slice(-MAX_HISTORY);
  // Die API verlangt eine Nutzernachricht am Anfang.
  while (kept[0]?.role !== "user") kept.shift();
  return kept;
}

/**
 * Einfaches Rate-Limit pro IP: true, wenn die Anfrage noch erlaubt ist.
 * shortcut: In-Memory je Function-Instanz, nur Fallback, wenn die Datenbank (chat_allow) nicht antwortet;
 * gehostet landet fast jede Anfrage auf einer neuen Instanz. Upgrade: Fallback sperrt statt erlaubt, falls Missbrauch sichtbar wird.
 */
export function allowRequest(hits: Map<string, number[]>, ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  const ok = recent.length < RATE_LIMIT;
  if (ok) recent.push(now);
  hits.set(ip, recent);
  // Speicher begrenzen: alte IPs fallen raus.
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return ok;
}
