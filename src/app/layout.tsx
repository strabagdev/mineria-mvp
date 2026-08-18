import React from "react";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "OpsAhead - Minería",
  description: "Carta gantt operacional para actividades e interferencias mineras",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MINERÍA",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#151D26",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className={inter.variable}>
        <ThemeProvider>
          <PwaRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
