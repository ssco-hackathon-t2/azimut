import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { KostenView } from "./KostenView";

export const metadata = { title: "Kosten · Andøya Addressability Tool" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Kosten pro Start" />}>
      <KostenView />
    </Suspense>
  );
}
