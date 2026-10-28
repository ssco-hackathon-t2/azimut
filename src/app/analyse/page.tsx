import { Suspense } from "react";
import { AnalysisView } from "./AnalysisView";
import { PageHead } from "@/components/shell/PageHead";

export const metadata = { title: "Analysis · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Analysis" />}>
      <AnalysisView />
    </Suspense>
  );
}
