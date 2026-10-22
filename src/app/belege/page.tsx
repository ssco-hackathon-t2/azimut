import { Suspense } from "react";
import { PageHead } from "@/components/shell/PageHead";
import { BelegeView } from "./BelegeView";

export const metadata = { title: "Belege · Azimut" };

export default function Page() {
  return (
    <Suspense fallback={<PageHead title="Belege" />}>
      <BelegeView />
    </Suspense>
  );
}
