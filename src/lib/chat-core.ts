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

// Spracheingabe und Vorlesen (Web Speech API)

export type VoiceLang = "en" | "de";
export const VOICE_LOCALE: Record<VoiceLang, string> = { en: "en-US", de: "de-DE" };
/** Stille nach dem letzten erkannten Wort, nach der die Aufnahme endet und die Frage abgeschickt wird. */
export const SILENCE_MS = 1500;
const VOICE_KEY = "azimut-chat-voice-lang";

/** Gemerkte Sprachwahl; ohne Speicher (privates Fenster, blockierte Website-Daten) Englisch. */
export function loadVoiceLang(storage: Pick<Storage, "getItem"> | undefined): VoiceLang {
  try {
    return storage?.getItem(VOICE_KEY) === "de" ? "de" : "en";
  } catch {
    return "en";
  }
}

export function saveVoiceLang(storage: Pick<Storage, "setItem"> | undefined, lang: VoiceLang) {
  try {
    storage?.setItem(VOICE_KEY, lang);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
}

/** Erkannter Text einer Aufnahme: alle Ergebnisse (endgültige und vorläufige) in Reihenfolge. */
export function transcriptOf(results: ArrayLike<ArrayLike<{ transcript: string }>>): string {
  return Array.from(results, (r) => r[0]?.transcript ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const VOICE_ERRORS: Record<VoiceLang, { blocked: string; silent: string; other: string }> = {
  en: {
    blocked: "Microphone access is blocked. Allow the microphone for this site in your browser and try again.",
    silent: "Didn't hear anything, please try again.",
    other: "Voice input didn't work. Please try again or type your question.",
  },
  de: {
    blocked: "Der Mikrofonzugriff ist blockiert. Bitte das Mikrofon für diese Seite im Browser freigeben und erneut versuchen.",
    silent: "Nichts gehört, bitte nochmal.",
    other: "Die Spracheingabe hat nicht geklappt. Bitte nochmal versuchen oder die Frage tippen.",
  },
};

/** Meldung zu einem SpeechRecognition-Fehlercode; null, wenn nichts anzuzeigen ist (selbst abgebrochen). */
export function voiceErrorMessage(code: string, lang: VoiceLang): string | null {
  if (code === "aborted") return null;
  const t = VOICE_ERRORS[lang];
  if (code === "not-allowed" || code === "service-not-allowed") return t.blocked;
  if (code === "no-speech") return t.silent;
  return t.other;
}
