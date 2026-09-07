import type { Metadata, Viewport } from "next";
import { Playfair_Display, Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-cormorant",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Hirena Makeup | Soft Glam Specialist Bandung 2026",
  description:
    "Hirena Makeup · Soft glam specialist in Bandung. Elegant, timeless bridal and event makeup artistry.",
  metadataBase: new URL("https://hirena.example.com"),
  openGraph: {
    title: "Hirena Makeup | Soft Glam Specialist Bandung 2026",
    description:
      "Soft glam specialist in Bandung · elegant, timeless bridal and event makeup.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFFCFA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${cormorant.variable} ${inter.variable}`}
    >
      <body className="antialiased bg-[#FFFCFA] text-[#1A1A1A] sans">
        {children}
      </body>
    </html>
  );
}
