import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { HistorieView } from "./HistorieView";

export const metadata = { title: "Historie · Andøya Addressability Tool" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Historie" />}>
      <HistorieView />
    </Suspense>
  );
}
