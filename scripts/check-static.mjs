// Abnahmeprüfung des statischen Exports unter dem Unterpfad (Dokument 13, Abschnitt 9).
// Voraussetzung: `pnpm build:pages` und `pnpm serve:pages` laufen; Chrome ist installiert.
// Externes Netz wird blockiert und protokolliert. Ergebnis: docs/frontend/evidence/final/check-report.json + Screenshots.
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:4173";
const BASE = process.env.BASE_PATH ?? "/azimut";
const OUT = resolve(process.argv[2] ?? "../docs/frontend/evidence/final");
const CHROME =
  process.env.CHROME ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => existsSync(p));

const ROUTES = ["/", "/analyse/", "/kosten/", "/standort/", "/historie/", "/kapital/", "/belege/", "/export/"];
const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true },
];

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "BESTANDEN " : "FEHLER    "} ${name}${detail ? ` · ${detail}` : ""}`);
};

async function newPage(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  const log = { errors: [], external: [], failed: [] };
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
    log.external.push(u);
    return route.abort();
  });
  page.on("console", (m) => m.type() === "error" && log.errors.push(m.text()));
  page.on("pageerror", (e) => log.errors.push(String(e)));
  page.on("response", (r) => r.url().startsWith(ORIGIN) && r.status() >= 400 && log.failed.push(`${r.status()} ${r.url()}`));
  return { ctx, page, log };
}

const url = (p) => `${ORIGIN}${BASE}${p}`;
const settle = (page, ms = 2500) => page.waitForTimeout(ms);

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
  const env = { chrome: CHROME, version: browser.version(), origin: ORIGIN, base: BASE, date: new Date().toISOString() };

  // 1. Alle Seiten in beiden Breiten
  for (const vp of VIEWPORTS) {
    for (const r of ROUTES) {
      const { ctx, page, log } = await newPage(browser, vp);
      const t0 = Date.now();
      const resp = await page.goto(url(r), { waitUntil: "load" });
      await page.locator("h1").first().waitFor({ timeout: 15000 });
      await settle(page, r === "/" ? 4000 : 2500);
      const loadMs = Date.now() - t0;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const tag = r === "/" ? "start" : r.replaceAll("/", "");
      await page.screenshot({ path: `${OUT}/${tag}_${vp.name}.png`, fullPage: r !== "/" });
      record(`${tag} ${vp.name}px lädt (HTTP ${resp?.status()})`, resp?.status() === 200, `${loadMs} ms bis stabil`);
      record(`${tag} ${vp.name}px ohne horizontales Scrollen`, overflow <= 1, `Überstand ${overflow}px`);
      record(`${tag} ${vp.name}px ohne Konsolenfehler`, log.errors.length === 0, log.errors.slice(0, 3).join(" | "));
      record(`${tag} ${vp.name}px ohne fehlende Assets`, log.failed.length === 0, log.failed.slice(0, 3).join(" | "));
      record(`${tag} ${vp.name}px ohne externe Abrufe`, log.external.length === 0, log.external.slice(0, 3).join(" | "));
      await ctx.close();
    }
  }

  // 2. Direktaufruf, Reload, Vor/Zurück, ein Run für alle Ansichten
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
    await page.goto(url("/analyse/?szenario=optimistic&jahr=2030"));
    const runText = () => page.locator("text=Aktiver Run").first().innerText();
    await page.locator("text=Aktiver Run").first().waitFor();
    record("Direktaufruf mit Parametern wählt Run", (await runText()).includes("andoya_all_payloads_2030_optimistic"), await runText());
    await page.reload();
    await page.locator("text=Aktiver Run").first().waitFor();
    record("Reload behält Run", (await runText()).includes("2030_optimistic"));
    await page.getByText("konservativ", { exact: true }).first().click();
    await page.waitForURL(/szenario=conservative/);
    record("Szenarioauswahl ändert URL und Run", (await runText()).includes("2030_conservative"));
    await page.goBack();
    await page.waitForURL(/szenario=optimistic/);
    record("Zurück stellt vorherigen Run her", (await runText()).includes("2030_optimistic"));
    await page.goForward();
    await page.waitForURL(/szenario=conservative/);
    record("Vor stellt Run wieder her", (await runText()).includes("2030_conservative"));
    await page.getByRole("link", { name: "Standort" }).first().click();
    await page.waitForURL(/standort\/\?.*szenario=conservative/);
    record("Navigation behält Auswahl über Seiten", page.url().includes("jahr=2030"), page.url());
    // Zoom und Zurücksetzen in der Zeitachse
    await page.goto(url("/analyse/?jahr=2030"));
    const chart = page.locator('[aria-label^="Zeitachse"]');
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.wheel(0, -600);
    await settle(page, 600);
    const reset = page.getByRole("button", { name: "Ansicht zurücksetzen" }).first();
    const enabled = await reset.isEnabled();
    if (enabled) await reset.click();
    await settle(page, 400);
    record("Diagramm zoomen und zurücksetzen", enabled && !(await reset.isEnabled()));
    // Tabelle als Alternative
    await page.getByText("Zeitachse als Tabelle").click();
    record("Zeitachse als Tabelle", await page.locator("table >> text=2035").first().isVisible());
    await ctx.close();
  }

  // 3. Einstieg: überspringen, Escape, Wiederholen
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
    await page.goto(url("/"));
    const skip = page.getByRole("button", { name: "Fahrt überspringen" });
    await skip.waitFor({ timeout: 15000 });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Fahrt wiederholen" }).waitFor({ timeout: 5000 });
    await settle(page, 800);
    record("Einstieg per Escape übersprungen", await page.locator("text=Andøya Spaceport, Pad A").first().isVisible());
    await page.screenshot({ path: `${OUT}/start_skip_1440.png` });
    await page.getByRole("link", { name: "Direkt zur Analyse" }).click();
    await page.waitForURL(/analyse/);
    record("„Direkt zur Analyse“ führt zur Analyse", true);
    // Tastatur: erstes Fokusziel ist der Sprunglink
    await page.goto(url("/"));
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
    record("Tastatur: Sprunglink zuerst fokussierbar", focused.includes("Skip to content"), focused);
    await ctx.close();
  }

  // 4. Reduzierte Bewegung: keine Fahrt, sofort Ziel
  {
    const { ctx, page, log } = await newPage(browser, VIEWPORTS[0], { reducedMotion: "reduce" });
    await page.goto(url("/"));
    await page.locator("text=Andøya Spaceport, Pad A").first().waitFor({ timeout: 15000 });
    const replay = await page.getByRole("button", { name: "Fahrt wiederholen" }).count();
    record("Reduzierte Bewegung zeigt sofort das Ziel ohne Fahrt", replay === 0 && log.errors.length === 0);
    await page.screenshot({ path: `${OUT}/start_reduced_motion_1440.png` });
    await ctx.close();
  }

  // 5. Leer- und Fehlerzustände: fehlende Datendatei
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
    await ctx.route("**/data/fixture/timeline.json", (r) => r.fulfill({ status: 404, body: "" }));
    await page.goto(url("/analyse/"));
    await page.getByText("Diese Ansicht konnte ihre Daten nicht laden").waitFor({ timeout: 10000 });
    record("Fehlende Datei zeigt verständlichen Fehler mit erneutem Laden", await page.getByRole("button", { name: "Erneut laden" }).isVisible());
    await ctx.unroute("**/data/fixture/timeline.json");
    await page.goto(url("/analyse/?jahr=1999"));
    await page.locator("text=Aktiver Run").first().waitFor().catch(() => {});
    record("Ungültiger Parameter fällt auf Standard-Run zurück", (await page.content()).includes("andoya_all_payloads_2025_base"));
    await ctx.close();
  }

  // 6. Belege, Export
  {
    const { ctx, page } = await newPage(browser, VIEWPORTS[0]);
    await page.goto(url("/belege/?jahr=2030&kpi=e3_revenue"));
    await page.getByRole("heading", { name: "Formel und Eingangszahlen" }).waitFor();
    record("Beleg per Direktlink (kpi=e3_revenue)", (await page.locator("pre").first().innerText()).length > 5);
    await page.goto(url("/export/?jahr=2030&szenario=optimistic"));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Herunterladen" }).first().click()]);
    record("Download Run-JSON", dl.suggestedFilename().includes("andoya_all_payloads_2030_optimistic"), dl.suggestedFilename());
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Herunterladen" }).nth(1).click()]);
    record("Download Zeitachse-CSV", dl2.suggestedFilename().endsWith(".csv"), dl2.suggestedFilename());
    const r404 = await page.goto(url("/gibt-es-nicht/"));
    record("Unbekannter Pfad liefert 404-Seite", r404?.status() === 404);
    await ctx.close();
  }
  await browser.close();

  // 7. Ohne WebGL: statischer Lageplan
  {
    const b2 = await chromium.launch({ executablePath: CHROME, args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
    const { ctx, page, log } = await newPage(b2, VIEWPORTS[0]);
    await page.goto(url("/"));
    await page.getByText("Lageplan (statisch)").waitFor({ timeout: 15000 });
    await settle(page, 1500);
    record("Ohne WebGL: gestalteter statischer Lageplan", log.errors.length === 0, log.errors.join(" | "));
    await page.screenshot({ path: `${OUT}/start_no_webgl_1440.png` });
    await ctx.close();
    await b2.close();
  }

  const passed = results.filter((r) => r.ok).length;
  await writeFile(`${OUT}/check-report.json`, JSON.stringify({ env, passed, failed: results.length - passed, results }, null, 2));
  console.log(`\n${passed}/${results.length} bestanden`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 2;
});
