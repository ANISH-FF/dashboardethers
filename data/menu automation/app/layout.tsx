import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MenuDigitizerAI – Digitize Menus in Seconds",
  description: "AI-powered menu digitizer with pricing, descriptions, and Excel export.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif", background: "#0f1117", margin: 0 }}>{children}</body>
    </html>
  );
}
