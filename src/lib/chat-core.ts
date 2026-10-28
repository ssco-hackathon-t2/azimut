// Reine Chat-Logik ohne React (testbar mit node --test): SSE-Stream der Function azimut-chat zerlegen.

export type ChatEvent = { text?: string; error?: string; done?: boolean };

/** Vollständige "data: …"-Ereignisse aus dem Puffer lesen; der unvollständige Rest bleibt für den nächsten Chunk. */
export function parseSSE(buffer: string): { events: ChatEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const part of parts) {
    for (const line of part.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      try {
        events.push(JSON.parse(line.slice(6)));
      } catch {
        // Kaputte Zeile überspringen statt den ganzen Stream abzubrechen.
      }
    }
  }
  return { events, rest };
}

/** Markdown-Reste (Fett, Überschriften) aus der Antwort entfernen; die Seite zeigt reinen Text. */
export const plainText = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s+/gm, "");
