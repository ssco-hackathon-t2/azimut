import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { BaukastenView } from "./BaukastenView";

export const metadata = { title: "Baukasten · Andøya Addressability Tool" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Diagramm-Baukasten" />}>
      <BaukastenView />
    </Suspense>
  );
}
