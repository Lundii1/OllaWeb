import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

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
      <body className="min-h-screen font-sans text-[var(--foreground)] antialiased">
        <div className="h-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
