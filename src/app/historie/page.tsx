import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { HistorieView } from "./HistorieView";

export const metadata = { title: "History · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="History" />}>
      <HistorieView />
    </Suspense>
  );
}
