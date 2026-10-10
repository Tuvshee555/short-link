import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Short links",
  description: "Private link shortener dashboard.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
