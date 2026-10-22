import { Suspense } from "react";
import { AnalysisView } from "./AnalysisView";
import { PageHead } from "@/components/shell/PageHead";

export const metadata = { title: "Analyse · Andøya Addressability Tool" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Analyse" />}>
      <AnalysisView />
    </Suspense>
  );
}
