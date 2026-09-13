import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ҳисоб — кирим-чиқим",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz-Cyrl">
      <body>{children}</body>
    </html>
  );
}
