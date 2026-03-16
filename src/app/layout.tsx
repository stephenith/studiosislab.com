import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Poppins } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Studiosis Lab",
  description: "Free resume builder with ad-supported downloads.",
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
        {children}
      </body>
    </html>
  );
}
