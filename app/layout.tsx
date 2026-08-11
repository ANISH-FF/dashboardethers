import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ethers — F&B Ops Suite",
  description: "Internal AI-powered menu, reports & marketing tool"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-paper text-ink antialiased selection:bg-ink selection:text-paper">
        {children}
      </body>
    </html>
  );
}
