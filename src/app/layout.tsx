import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Poppins } from "next/font/google";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { Providers } from "./providers";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "StudiosisLab",
  description:
    "Create resumes, manage documents, and prepare e-sign workflows with StudiosisLab’s simple online productivity tools.",
  metadataBase: new URL("https://studiosislab.com"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/branding/favicon.ico" },
      {
        url: "/branding/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/branding/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: "/branding/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "StudiosisLab",
    images: [
      {
        url: "/branding/og-default.png",
        width: 1200,
        height: 630,
        alt: "StudiosisLab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/branding/twitter-image.png"],
  },
  verification: {
    google: "Z8_dQuj8VOTEdsit3LZe4fuWrh9j4YB7Xw5ijA1QLKA",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${poppins.variable} ${inter.variable}`}>
      <body className="h-full font-body">
        {process.env.NODE_ENV === "production" && (
          <Script
            async
            strategy="afterInteractive"
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-TESTING_PLACEHOLDER"
            crossOrigin="anonymous"
          />
        )}
        <Providers>{children}</Providers>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
