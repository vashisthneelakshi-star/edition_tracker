import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Desk — Content Command",
  description: "Rajasthan Patrika content planning & operations platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
