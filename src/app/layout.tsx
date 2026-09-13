import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hisob — kirim-chiqim",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
