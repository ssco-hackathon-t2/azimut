import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { BelegeView } from "./BelegeView";

export const metadata = { title: "Evidence · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Evidence" />}>
      <BelegeView />
    </Suspense>
  );
}
