import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Folio — A new format. Same good work.",
  description:
    "Convert Markdown, Word documents, PDFs and images. A fresh format for your best work.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
