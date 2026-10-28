import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSSE, plainText } from "../../src/lib/chat-core.ts";
import { allowRequest, limitMessage, originAllowed, parseHistory, MAX_HISTORY, RATE_LIMIT, RATE_WINDOW_MS } from "../../supabase/functions/azimut-chat/guard.ts";

test("Chat: SSE-Ereignisse über Chunk-Grenzen", () => {
  const a = parseSSE('data: {"text":"Hel"}\n\ndata: {"te');
  assert.deepEqual(a.events, [{ text: "Hel" }]);
  const b = parseSSE(a.rest + 'xt":"lo"}\n\ndata: {"done":true}\n\n');
  assert.deepEqual(b.events, [{ text: "lo" }, { done: true }]);
  assert.equal(b.rest, "");
  assert.equal(plainText("## Yes\n**Support** it"), "Yes\nSupport it");
});

test("Chat: Verlauf auf die letzten Nachrichten kürzen, beginnt mit Nutzer", () => {
  const msgs = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const out = parseHistory({ messages: msgs });
  assert.ok(Array.isArray(out));
  assert.ok(out.length <= MAX_HISTORY);
  assert.equal(out[0].role, "user");
  assert.equal(out.at(-1)!.content, "m10");
  assert.equal(parseHistory({ messages: [{ role: "user", content: "x".repeat(1001) }] }), "message too long");
  assert.equal(parseHistory({ messages: [{ role: "system", content: "hi" }] }), "invalid message");
  assert.equal(parseHistory({ messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] }), "last message must be from the user");
});

test("Chat: Rate-Limit pro IP und Stunde", () => {
  const hits = new Map<string, number[]>();
  for (let i = 0; i < RATE_LIMIT; i++) assert.ok(allowRequest(hits, "1.2.3.4", 1000 + i));
  assert.equal(allowRequest(hits, "1.2.3.4", 2000), false);
  assert.ok(allowRequest(hits, "5.6.7.8", 2000), "andere IP unabhängig");
  assert.ok(allowRequest(hits, "1.2.3.4", 1000 + RATE_WINDOW_MS + 1), "nach einer Stunde wieder frei");
});

test("Chat: eigene Meldung für IP- und globales Tageslimit", () => {
  assert.equal(RATE_LIMIT, 60);
  assert.equal(limitMessage("ok"), null);
  assert.match(limitMessage("ip")!, /in an hour/);
  assert.match(limitMessage("global")!, /daily limit/);
});

test("Chat: nur eigene Origin und localhost", () => {
  assert.ok(originAllowed("https://ssco-hackathon-t2.github.io"));
  assert.ok(originAllowed("http://localhost:3000"));
  assert.equal(originAllowed("https://evil.example"), false);
  assert.equal(originAllowed("https://ssco-hackathon-t2.github.io.evil.example"), false);
  assert.equal(originAllowed(null), false);
});
