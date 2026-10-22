import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { ExportView } from "./ExportView";

export const metadata = { title: "Export · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Export" />}>
      <ExportView />
    </Suspense>
  );
}
