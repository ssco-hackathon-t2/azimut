import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { KapitalView } from "./KapitalView";

export const metadata = { title: "Capital · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Capital" />}>
      <KapitalView />
    </Suspense>
  );
}
