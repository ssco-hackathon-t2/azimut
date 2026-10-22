// Nachbearbeitung des statischen Exports (Next.js 16.4, output: "export", trailingSlash).
// Der Export legt Segment-Prefetch-Dateien verschachtelt ab (belege/__next.belege/__PAGE__.txt),
// der Client fragt aber flach an (belege/__next.belege.__PAGE__.txt). Ohne Server, der umschreibt,
// entstehen 404 im Browser. Wir legen eine flache Kopie daneben; die verschachtelte bleibt erhalten.
// ponytail: Workaround für diese Next-Version; bei einem Update prüfen, ob der Export das selbst erledigt.
import { copyFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const out = process.argv[2] ?? "out";
let n = 0;

async function walk(dir) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if (!(await stat(p)).isDirectory()) continue;
    if (name.startsWith("__next.")) await flatten(p, dir, name);
    else await walk(p);
  }
}

async function flatten(segDir, parent, segName) {
  const files = [];
  const collect = async (d) => {
    for (const f of await readdir(d)) {
      const p = join(d, f);
      if ((await stat(p)).isDirectory()) await collect(p);
      else files.push(p);
    }
  };
  await collect(segDir);
  for (const f of files) {
    const flat = `${segName}.${relative(segDir, f).split(sep).join(".")}`;
    await copyFile(f, join(parent, flat));
    n++;
  }
}

await walk(out);
console.log(`flatten-segments: ${n} Segmentdateien flach abgelegt`);
