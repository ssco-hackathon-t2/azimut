import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { HistorieView } from "./HistorieView";

export const metadata = { title: "Historie · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Historie" />}>
      <HistorieView />
    </Suspense>
  );
}
