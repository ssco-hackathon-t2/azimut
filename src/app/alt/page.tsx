import { Suspense } from "react";
import { HomeView } from "../HomeView";

/** Frühere Startseite mit der Kamerafahrt zum Andøya-Pad. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomeView hero="andoya" />
    </Suspense>
  );
}
