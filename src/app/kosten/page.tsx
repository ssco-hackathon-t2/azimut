import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { KostenView } from "./KostenView";

export const metadata = { title: "Costs · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Cost per launch" />}>
      <KostenView />
    </Suspense>
  );
}
