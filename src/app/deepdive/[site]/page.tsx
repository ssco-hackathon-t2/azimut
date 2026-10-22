import { Suspense } from "react";
import { DeepDiveView } from "../DeepDiveView";
// Fester Import statt Datei lesen: gilt für Build und Dev-Server, egal aus welchem Ordner gestartet.
import sc from "../../../../public/data/sites/sites_compare.json";

// Statischer Export: nur die Plätze aus sites_compare.json, alles andere 404.
export const dynamicParams = false;

/** Eine Deep-Dive-Seite je Startplatz aus sites_compare.json (andoya, nova_scotia, …). */
export function generateStaticParams() {
  return sc.sites.map((s) => ({ site: s.id }));
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  return (
    <Suspense fallback={null}>
      <DeepDiveView site={site} />
    </Suspense>
  );
}
