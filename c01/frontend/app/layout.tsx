import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "AES Image Encryptor" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
