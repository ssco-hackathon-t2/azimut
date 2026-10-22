import { Suspense } from "react";
import { DeepDiveView } from "./DeepDiveView";

/** /deepdive/ bleibt der Deep Dive Andøya (alte Links); die Seiten je Platz liegen unter /deepdive/<id>/. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <DeepDiveView site="andoya" />
    </Suspense>
  );
}
