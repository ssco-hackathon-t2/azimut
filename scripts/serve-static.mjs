// Statischer Server wie GitHub Pages: liefert web/out unter einem Unterpfad aus, ohne Node-Anwendungslogik.
// Verzeichnis -> index.html, fehlende Datei -> 404.html mit Status 404. Nur für lokale Prüfungen.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? new URL("../out", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const base = (process.env.BASE_PATH ?? "/azimut").replace(/\/$/, "");
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

async function file(p) {
  try {
    const s = await stat(p);
    if (s.isDirectory()) return file(join(p, "index.html"));
    return { path: p, body: await readFile(p) };
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let path = decodeURIComponent(url.pathname);
  if (path === "/" || path === base) {
    res.writeHead(302, { location: `${base}/` });
    return res.end();
  }
  if (!path.startsWith(`${base}/`)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Nicht unter dem Unterpfad");
  }
  const rel = normalize(path.slice(base.length)).replace(/^([/\\])+/, "");
  const target = resolve(root, rel);
  if (!target.startsWith(root)) {
    res.writeHead(403);
    return res.end();
  }
  const hit = await file(target);
  if (hit) {
    res.writeHead(200, { "content-type": TYPES[extname(hit.path)] ?? "application/octet-stream", "cache-control": "no-cache" });
    return res.end(hit.body);
  }
  const nf = await file(join(root, "404.html"));
  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(nf?.body ?? "404");
}).listen(port, "127.0.0.1", () => console.log(`statisch: http://127.0.0.1:${port}${base}/  (Wurzel ${root})`));
