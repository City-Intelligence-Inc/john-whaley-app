import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Selecta",
  description: "AI-powered event guest selection for Inception Studio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Toaster
            richColors
            theme="dark"
            toastOptions={{
              style: {
                background: "hsl(220 18% 10%)",
                border: "1px solid hsl(220 15% 18%)",
                color: "hsl(40 10% 92%)",
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
