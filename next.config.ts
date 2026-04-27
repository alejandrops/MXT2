import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Moved out of experimental as of Next 15.5+
  typedRoutes: true,
  // Hide the Next.js dev mode badge ("N" indicator that shows
  // build status). Useful when reviewing the demo so the chrome
  // doesn't distract from the actual UI.
  devIndicators: false,
};

export default nextConfig;
