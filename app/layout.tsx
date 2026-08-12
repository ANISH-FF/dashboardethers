import "./globals.css";
import type { Metadata } from "next";
import InspectBlocker from "@/components/InspectBlocker";

export const metadata: Metadata = {
  title: "Ethers — F&B Ops Suite",
  description: "Internal AI-powered menu, reports & marketing tool",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png"
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-paper text-ink antialiased selection:bg-ink selection:text-paper">
        <InspectBlocker />
        {children}
      </body>
    </html>
  );
}
