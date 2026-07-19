import type { Metadata } from "next";
import { FirebaseAccountBar } from "@/components/FirebaseAccountBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trizzy Writer",
  description: "Trey Trizzy's private AI songwriting workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <FirebaseAccountBar />
        {children}
      </body>
    </html>
  );
}
