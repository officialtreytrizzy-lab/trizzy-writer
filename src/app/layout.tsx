import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trizzy Writer",
  description: "Trey Trizzy's private AI songwriting workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
