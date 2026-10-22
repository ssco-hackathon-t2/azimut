import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Unterpfad für GitHub Pages (Vorschlag: /azimut). Leer = Wurzel, z. B. lokal.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  reactStrictMode: true,
  // Root-Workspace liegt eine Ebene höher (Python-Projekt); Tracing auf web/ begrenzen.
  outputFileTracingRoot: __dirname,
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return { ...nextConfig, output: undefined, async rewrites() {
      return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
    } };
  }
  return nextConfig;
}
