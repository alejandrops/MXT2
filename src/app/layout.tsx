import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeBoot } from "@/components/theme/ThemeBoot";
import "./globals.css";

// ═══════════════════════════════════════════════════════════════
//  Root layout · fonts + base body only
//  ─────────────────────────────────────────────────────────────
//  The actual product/admin shells live in route group layouts:
//    · (product)/layout.tsx  · main app with light Sidebar+Topbar
//    · admin/layout.tsx      · backoffice with dark sidebar
//  This separation lets each surface have its own chrome without
//  conditional rendering tricks.
//
//  ThemeBoot is an inline script that runs BEFORE the first paint,
//  reads the `mxt-theme` cookie, and applies data-theme on <html>.
//  Avoids "flash of unstyled content" when user prefers dark mode.
// ═══════════════════════════════════════════════════════════════

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Maxtracker — Demo Funcional",
  description:
    "Plataforma IoT de gestión de activos · Demo con datos simulados",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <ThemeBoot />
        {children}
      </body>
    </html>
  );
}
