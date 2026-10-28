"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadVoiceLang,
  parseSSE,
  plainText,
  saveVoiceLang,
  SILENCE_MS,
  transcriptOf,
  VOICE_LOCALE,
  voiceErrorMessage,
  type VoiceLang,
} from "@/lib/chat-core";

// Supabase Edge Function azimut-chat (nicht geheim). Leer = Chat ausgeschaltet, die Seite bleibt unverändert.
const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_URL ?? "";
const MAX_INPUT = 1000;
const SUGGESTIONS = ["Should we invest, yes or no?", "Why is a second pad the priority?", "What are the main risks?"];

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

// Web Speech API: nur der Teil, den der Chat nutzt (nicht in lib.dom enthalten).
type Recognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognizerCtor = new () => Recognizer;

function recognizerCtor(): RecognizerCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function speak(text: string, lang: VoiceLang) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = VOICE_LOCALE[lang];
  // Passende Stimme ausdrücklich wählen; manche Browser ignorieren lang allein.
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}

/** localStorage kann im privaten Fenster oder bei gesperrten Website-Daten schon beim Zugriff werfen. */
function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function ChatAssistant() {
  if (!CHAT_URL) return null;
  return <Chat />;
}

function Chat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState({ mic: false, tts: false });
  const [readAloud, setReadAloud] = useState(false);
  const [lang, setLang] = useState<VoiceLang>("en");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const heard = useRef("");
  const silence = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sendOnEnd = useRef(false);
  const list = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Sprachfunktionen erst im Browser prüfen (statischer Export rendert ohne window).
  useEffect(() => {
    setVoice({ mic: !!recognizerCtor(), tts: "speechSynthesis" in window });
    setLang(loadVoiceLang(browserStorage()));
  }, []);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [msgs]);

  useEffect(
    () => () => {
      abort.current?.abort();
      clearTimeout(silence.current);
      sendOnEnd.current = false;
      rec.current?.abort();
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
    [],
  );

  function close() {
    setOpen(false);
    stopListening(false);
    if (voice.tts) speechSynthesis.cancel();
    requestAnimationFrame(() => button.current?.focus());
  }

  function switchLang() {
    const next = lang === "en" ? "de" : "en";
    setLang(next);
    saveVoiceLang(browserStorage(), next);
  }

  // speakAnswer als Argument: ein per Stimme gestartetes ask sieht das eben eingeschaltete readAloud noch nicht.
  async function ask(question: string, speakAnswer = readAloud) {
    const q = question.trim().slice(0, MAX_INPUT);
    if (!q || busy) return;
    const history = [...msgs.filter((m) => !m.error), { role: "user" as const, content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setVoiceError(null);
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    let answer = "";
    const update = (content: string, error = false) =>
      setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content, error }]);
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-8).map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null);
        throw new Error(res.status === 429 && detail?.error ? detail.error : "unavailable");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const { events, rest } = parseSSE(buf + dec.decode(value, { stream: true }));
        buf = rest;
        for (const ev of events) {
          if (ev.error) throw new Error(ev.error);
          if (ev.text) update((answer += ev.text));
        }
      }
      if (!answer) throw new Error("unavailable");
      if (speakAnswer) speak(plainText(answer), lang);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      // TypeError = Netzwerkfehler (Function nicht erreichbar); Server-Meldungen sind für Nutzer formuliert.
      const msg = e instanceof Error && !(e instanceof TypeError) && e.message !== "unavailable" ? e.message : "";
      update(answer || msg || "The assistant is not reachable right now. All figures are on the page itself, and the sources are under Evidence.", true);
    } finally {
      if (abort.current === ctrl) abort.current = null;
      setBusy(false);
    }
  }

  // Aufnahme beenden; mit send schickt onend den erkannten Text ab, sonst wird er verworfen.
  function stopListening(send: boolean) {
    clearTimeout(silence.current);
    sendOnEnd.current = send;
    if (send) rec.current?.stop();
    else rec.current?.abort();
  }

  function toggleMic() {
    // Zweiter Klick: aufhören und das bisher Erkannte absenden.
    if (listening) return stopListening(true);
    const Ctor = recognizerCtor();
    if (!Ctor || busy) return;
    const r = new Ctor();
    r.lang = VOICE_LOCALE[lang];
    r.continuous = true;
    r.interimResults = true;
    heard.current = "";
    sendOnEnd.current = false;
    r.onresult = (e) => {
      heard.current = transcriptOf(e.results);
      setInput(heard.current);
      // Nach SILENCE_MS ohne neues Ergebnis gilt die Frage als fertig.
      clearTimeout(silence.current);
      silence.current = setTimeout(() => stopListening(true), SILENCE_MS);
    };
    r.onerror = (e) => {
      sendOnEnd.current = false;
      setVoiceError(voiceErrorMessage(e.error, lang));
    };
    r.onend = () => {
      clearTimeout(silence.current);
      rec.current = null;
      setListening(false);
      if (sendOnEnd.current && heard.current) {
        // Gesprochene Frage: Antwort vorlesen, auch für die folgenden Fragen.
        if (voice.tts) setReadAloud(true);
        ask(heard.current, voice.tts);
      }
      sendOnEnd.current = false;
    };
    rec.current = r;
    setVoiceError(null);
    setInput("");
    setListening(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
      setVoiceError(voiceErrorMessage("start-failed", lang));
    }
  }

  return (
    <>
      {!open && (
        <button
          ref={button}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 border border-ice/60 bg-night-2/95 px-4 py-3 text-[0.95rem] text-snow shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur hover:border-ice sm:bottom-6 sm:right-6"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-ice" strokeWidth="1.8">
            <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
          </svg>
          Ask Azimut
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Azimut assistant"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[min(40rem,calc(100dvh-1rem))] flex-col border border-rule-strong bg-night-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[26rem]"
        >
          <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
            <div className="mr-auto">
              <p className="font-display text-[1.02rem] text-snow">Ask Azimut</p>
              <p className="text-[0.76rem] text-mist">Answers only from this tool&apos;s data. Not investment advice.</p>
            </div>
            {voice.tts && (
              <button
                type="button"
                aria-pressed={readAloud}
                onClick={() => {
                  if (readAloud) speechSynthesis.cancel();
                  setReadAloud(!readAloud);
                }}
                title={readAloud ? "Stop reading answers aloud" : "Read answers aloud"}
                className={`border px-2 py-1 text-[0.8rem] ${readAloud ? "border-ice text-snow" : "border-rule-strong text-mist hover:text-snow"}`}
              >
                <span className="sr-only">Read answers aloud</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
                  <path d="M4 9v6h4l5 4V5L8 9z" strokeLinejoin="round" />
                  {readAloud && <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" />}
                </svg>
              </button>
            )}
            <button type="button" onClick={close} className="border border-rule-strong px-2 py-1 text-[0.8rem] text-mist hover:text-snow">
              <span className="sr-only">Close assistant</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 stroke-current" strokeWidth="1.8">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div ref={list} aria-live="polite" className="min-h-[8rem] flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[0.92rem]">
            {msgs.length === 0 && (
              <div>
                <p className="text-mist">Ask about the Isar Aerospace case, for example:</p>
                <div className="mt-2 flex flex-col items-start gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} className="border border-rule-strong px-3 py-1.5 text-left text-snow hover:border-ice">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="ml-8 whitespace-pre-wrap border-l-2 border-ice bg-night-3 px-3 py-2 text-snow">
                  {m.content}
                </p>
              ) : (
                <p key={i} className={`whitespace-pre-wrap leading-relaxed ${m.error ? "text-amber" : "text-snow"}`}>
                  {m.content ? plainText(m.content) : <span className="text-mist">Thinking …</span>}
                </p>
              ),
            )}
          </div>

          {voiceError && (
            <p role="alert" className="border-t border-rule px-4 py-2 text-[0.82rem] leading-snug text-amber">
              {voiceError}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-end gap-2 border-t border-rule px-3 py-3"
          >
            <label htmlFor="azimut-chat-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="azimut-chat-input"
              ref={field}
              rows={2}
              maxLength={MAX_INPUT}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder={listening ? "Listening …" : "Your question"}
              className="min-w-0 flex-1 resize-none border border-rule-strong bg-night px-3 py-2 text-[0.95rem] text-snow placeholder:text-mist-2 focus:border-ice focus:outline-none"
            />
            {(voice.mic || voice.tts) && (
              <button
                type="button"
                onClick={switchLang}
                disabled={listening}
                aria-label={lang === "en" ? "Voice language English, switch to German" : "Sprache Deutsch, auf Englisch umschalten"}
                title={lang === "en" ? "Voice: English" : "Stimme: Deutsch"}
                className="border border-rule-strong px-2 py-2 font-mono text-[0.8rem] text-mist hover:text-snow disabled:opacity-50"
              >
                {lang.toUpperCase()}
              </button>
            )}
            {voice.mic && (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                disabled={busy}
                className={`border px-3 py-2 ${listening ? "border-red text-red" : "border-rule-strong text-mist hover:text-snow"} disabled:opacity-50`}
              >
                <span className="sr-only">{listening ? "Stop and send" : "Ask by voice"}</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="border border-ice/70 bg-night-3 px-3 py-2 text-[0.9rem] text-snow hover:border-ice disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
