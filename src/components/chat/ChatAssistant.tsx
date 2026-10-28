"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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
  // Passende Stimme ausdrücklich wählen; manche Browser ignorieren lang allein.
  const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang));
  // Chrome bricht lange Äußerungen nach etwa 15 s ab, daher satzweise in die Warteschlange.
  for (const part of text.match(/[^.!?\n]+[.!?]*/g) ?? [text]) {
    if (!part.trim()) continue;
    const u = new SpeechSynthesisUtterance(part.trim());
    u.lang = VOICE_LOCALE[lang];
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }
}

/** Umlaufbahn als Markenzeichen; der Punkt kreist nur, solange eine Antwort entsteht. */
function OrbitMark({ moving = false, className = "" }: { moving?: boolean; className?: string }) {
  const [calm, setCalm] = useState(false);
  useEffect(() => setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`shrink-0 ${className}`}>
      <ellipse cx="16" cy="16" rx="13" ry="6.5" transform="rotate(-24 16 16)" className="fill-none stroke-ice/55" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="3.2" className="fill-snow" />
      <g transform="rotate(-24 16 16)">
        {moving && !calm ? (
          <circle r="2" className="fill-ice">
            <animateMotion dur="1.6s" repeatCount="indefinite" path="M29 16 A13 6.5 0 1 1 3 16 A13 6.5 0 1 1 29 16" />
          </circle>
        ) : (
          <circle cx="29" cy="16" r="2" className="fill-ice" />
        )}
      </g>
    </svg>
  );
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

  function chooseLang(next: VoiceLang) {
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

  const iconBtn =
    "grid h-9 w-9 place-items-center text-mist transition-colors hover:bg-white/5 hover:text-snow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ice";
  const langName = lang === "de" ? "German" : "English";

  return (
    <>
      {!open && (
        <button
          ref={button}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 border border-ice/35 bg-[rgba(8,11,18,0.72)] py-2.5 pl-3 pr-3 font-display sm:pr-4 text-[0.98rem] text-snow shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-md transition-colors hover:border-ice focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice sm:bottom-6 sm:right-6"
        >
          <OrbitMark className="h-7 w-7" />
          {/* Auf dem Handy nur das Zeichen, damit der Button keine Bildunterschriften verdeckt. */}
          <span className="max-sm:sr-only">Ask Azimut</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Ask Azimut"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="chat-panel fixed inset-x-2 bottom-2 z-50 flex max-h-[calc(100dvh-1rem)] flex-col border border-rule-strong/70 bg-[rgba(8,11,18,0.88)] shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[min(40rem,calc(100dvh-3rem))] sm:w-[28rem]"
        >
          <header className="flex items-center gap-3 border-b border-rule/70 py-3 pl-4 pr-2">
            <OrbitMark moving={busy} className="h-8 w-8" />
            <div className="mr-auto min-w-0">
              <h2 className="font-display text-[1.06rem] font-semibold leading-tight text-snow">Ask Azimut</h2>
              <p className="text-[0.78rem] leading-snug text-mist">From this tool&apos;s data. Not investment advice.</p>
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
                className={`${iconBtn} ${readAloud ? "text-ice" : ""}`}
              >
                <span className="sr-only">Read answers aloud</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth="1.7">
                  <path d="M4 9v6h4l5 4V5L8 9z" strokeLinejoin="round" />
                  {readAloud ? (
                    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" strokeLinecap="round" />
                  ) : (
                    <path d="M17 10l4 4M21 10l-4 4" strokeLinecap="round" />
                  )}
                </svg>
              </button>
            )}
            <button type="button" onClick={close} className={iconBtn}>
              <span className="sr-only">Close assistant</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" strokeWidth="1.7">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div ref={list} aria-live="polite" className="min-h-[10rem] flex-1 overflow-y-auto px-5 py-5">
            {msgs.length === 0 ? (
              <div>
                <p className="max-w-[22ch] font-display text-[1.32rem] font-medium leading-snug text-snow">
                  What would you like to know about the Isar Aerospace case?
                </p>
                <ul className="mt-5 border-b border-rule/60">
                  {SUGGESTIONS.map((s) => (
                    <li key={s} className="border-t border-rule/60">
                      <button
                        type="button"
                        onClick={() => ask(s)}
                        className="w-full py-3 text-left text-[0.96rem] text-snow/85 transition-colors hover:text-ice focus-visible:outline focus-visible:outline-2 focus-visible:outline-ice"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              msgs.map((m, i) =>
                m.role === "user" ? (
                  <p key={i} className="mt-7 whitespace-pre-wrap font-display text-[1.1rem] font-medium leading-snug text-snow first:mt-0">
                    {m.content}
                  </p>
                ) : (
                  <Fragment key={i}>
                    {m.content ? (
                      <p
                        className={`mt-3 whitespace-pre-wrap border-l pl-4 text-[0.94rem] leading-[1.65] ${m.error ? "border-amber/70 text-amber" : "border-ice/45 text-snow/85"}`}
                      >
                        {plainText(m.content)}
                      </p>
                    ) : (
                      <p className="mt-3 flex items-center gap-2 border-l border-ice/45 pl-4 text-[0.9rem] text-mist">
                        <OrbitMark moving className="h-5 w-5" />
                        Working through the data
                      </p>
                    )}
                  </Fragment>
                ),
              )
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="border-t border-rule/70 p-3"
          >
            {voiceError ? (
              <p role="alert" className="px-1 pb-2 text-[0.8rem] leading-snug text-amber">
                {voiceError}
              </p>
            ) : (
              listening && (
                <p role="status" className="px-1 pb-2 text-[0.8rem] text-ice">
                  Listening in {langName}. Pause briefly to send.
                </p>
              )
            )}
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
              placeholder={listening ? "Speak now" : "Type a question"}
              className="block w-full resize-none border border-rule-strong/80 bg-black/50 px-3 py-2.5 text-[0.95rem] text-snow placeholder:text-mist-2 focus:border-ice focus:outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              {(voice.mic || voice.tts) && (
                <div role="group" aria-label="Voice language" className="flex border border-rule-strong/80 text-[0.78rem]">
                  {(["en", "de"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={lang === l}
                      disabled={listening}
                      onClick={() => chooseLang(l)}
                      title={l === "en" ? "Voice: English" : "Stimme: Deutsch"}
                      className={`px-2.5 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ice disabled:opacity-60 ${lang === l ? "bg-ice/15 text-snow" : "text-mist hover:text-snow"}`}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              {voice.mic && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-pressed={listening}
                  disabled={busy}
                  className={`relative grid h-9 w-9 place-items-center border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ice disabled:opacity-40 ${listening ? "border-red bg-red/15 text-red" : "border-rule-strong/80 text-mist hover:text-snow"}`}
                >
                  {listening && <span aria-hidden="true" className="chat-pulse absolute inset-0 border border-red" />}
                  <span className="sr-only">{listening ? "Stop and send" : "Ask by voice"}</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current" strokeWidth="1.7">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !input.trim() || listening}
                className="ml-auto bg-ice px-4 py-2 text-[0.9rem] font-medium text-black transition-colors hover:bg-snow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice disabled:bg-ice/25 disabled:text-mist"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
