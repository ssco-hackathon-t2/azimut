import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { KapitalView } from "./KapitalView";

export const metadata = { title: "Kapital · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Kapital" />}>
      <KapitalView />
    </Suspense>
  );
}
