import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Leader Team Control",
  description: "Monitoring skill member dan mapping peningkatan member — Finishing Line",
  // PRD v3 F-1501: manifest comes from app/manifest.ts; iOS reads these instead.
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-180.png" },
  appleWebApp: { capable: true, title: "LTC Member", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
