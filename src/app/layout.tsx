import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studiosis Lab",
  description: "Free resume builder with ad-supported downloads."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {process.env.NODE_ENV === "production" && (
          <Script
            async
            strategy="afterInteractive"
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-TESTING_PLACEHOLDER"
            crossOrigin="anonymous"
          />
        )}
        {children}
      </body>
    </html>
  );
}
