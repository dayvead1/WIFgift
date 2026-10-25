import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WIF Gift",
  description: "Send a little WIF to someone you like.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
