import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReleaseGuard Demo Checkout",
  description: "Small checkout flow used by the ReleaseGuard v0.1 demo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
