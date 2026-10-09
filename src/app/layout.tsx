import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AlphabetOverlay } from "@/components/AlphabetOverlay";
import { ALPHABET_COOKIE } from "@/lib/alphabet";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ҳисоб — кирим-чиқим",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const initialAlphabet = store.get(ALPHABET_COOKIE)?.value === "lat" ? "lat" : "cyr";

  return (
    <html lang="uz-Cyrl" data-alphabet={initialAlphabet}>
      <body>
        {children}
        <AlphabetOverlay />
      </body>
    </html>
  );
}
