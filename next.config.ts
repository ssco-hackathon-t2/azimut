import type { NextConfig } from "next";

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

export default nextConfig;
