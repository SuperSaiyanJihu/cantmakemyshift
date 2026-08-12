import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "Can’t Make My Shift | Excel Aquatics",
    description: "Clear, step-by-step call-out directions for Excel Aquatics employees.",
    // Lets staff keep the app on their home screen instead of hunting for a link.
    manifest: "/manifest.webmanifest",
    applicationName: "Can’t Make My Shift",
    appleWebApp: { capable: true, title: "My Shift", statusBarStyle: "default" },
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: { title: "Can’t Make My Shift", description: "Clear call-out directions. Two quick steps.", images: [image] },
    twitter: { card: "summary_large_image", title: "Can’t Make My Shift", description: "Clear call-out directions. Two quick steps.", images: [image] },
  };
}

export const viewport: Viewport = {
  themeColor: "#0d493f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}>{children}</body></html>;
}
