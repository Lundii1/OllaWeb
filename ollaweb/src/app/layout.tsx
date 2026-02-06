import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  variable: "--font-retro",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OllaWeb",
  description: "Ollama web wrapper",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${vt323.variable} font-retro`}>
        {children}
      </body>
    </html>
  );
}
