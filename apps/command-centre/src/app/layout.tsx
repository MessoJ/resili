import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "resili — Operations Console",
  description:
    "Climate risk intelligence and anticipatory action for the Lake Victoria Basin. " +
    "Decision-support estimates — follow KMD, NDMA, and county directives.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
