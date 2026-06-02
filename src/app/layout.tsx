import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/context/LanguageContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gomoku AI Platform",
  description: "Train, Upload, and Battle Gomoku AIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2745624150105717" crossOrigin="anonymous"></script>
      </head>
      <body className={`${inter.className} bg-slate-900 text-white min-h-screen flex flex-col`}>
        <LanguageProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            {children}
          </main>
        </LanguageProvider>
      </body>
    </html>
  );
}
