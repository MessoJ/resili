import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "resili — Console",
  description:
    "Climate risk intelligence and anticipatory action for the Lake Victoria Basin. " +
    "Decision-support estimates — follow KMD, NDMA, and county directives.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
