import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L1.5c · `typescript.ignoreBuildErrors` removido · typecheck ya pasa
  // limpio (L1.5a + L1.5b cerraron los 119 errores preexistentes).
  // De ahora en más, errors de TS rompen el build (lo deseable).
  eslint: {
    ignoreDuringBuilds: true,
  },

  reactStrictMode: true,
  // Moved out of experimental as of Next 15.5+
  typedRoutes: true,
  // Hide the Next.js dev mode badge ("N" indicator that shows
  // build status). Useful when reviewing the demo so the chrome
  // doesn't distract from the actual UI.
  devIndicators: false,

  // ─── Legacy redirects ───────────────────────────────────────
  // /gestion/* fue reemplazado por /catalogos/* en el modelo
  // mental del producto. Estos redirects mantienen compatibilidad
  // con bookmarks externos / URLs compartidas previas.
  // Son permanentes (308) · al ser una decisión de modelo, no un
  // experimento, queremos que los caches y crawlers actualicen.
  async redirects() {
    return [
      {
        source: "/gestion",
        destination: "/catalogos",
        permanent: true,
      },
      {
        source: "/gestion/:path*",
        destination: "/catalogos/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
