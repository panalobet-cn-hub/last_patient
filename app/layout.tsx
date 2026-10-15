import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "The Last Patient | Halloween Mystery",
  description:
    "A Halloween asylum murder mystery. Investigate. Find the truth. Close the case.",
  robots: { index: false, follow: false },
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
