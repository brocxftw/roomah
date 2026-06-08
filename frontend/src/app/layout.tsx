import type { Metadata } from "next";
import { Comfortaa, Jost, Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";

const robotoSans = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

const comfortaa = Comfortaa({
  variable: "--font-comfortaa",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "700"],
});

// Garet is a commercial typeface and is not on Google Fonts; Jost is a close
// geometric-sans fallback. Self-host Garet later to use it as the primary face.
const garetFallback = Jost({
  variable: "--font-garet",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "ROOMAH",
  description: "Operational CRM for Malaysian Real Estate Negotiators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${robotoSans.variable} ${robotoMono.variable} ${comfortaa.variable} ${garetFallback.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
