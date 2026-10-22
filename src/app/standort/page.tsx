import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { StandortView } from "./StandortView";

export const metadata = { title: "Standort · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Standort" />}>
      <StandortView />
    </Suspense>
  );
}
