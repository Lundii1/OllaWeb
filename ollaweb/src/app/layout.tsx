import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Voltaire",
  description: "Voltaire AI Assistant",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-screen text-[var(--foreground)] antialiased`}>
        <div className="h-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
