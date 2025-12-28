import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Post to PDF - Convert Social Media Posts to Professional PDFs",
  description:
    "Extract images and metadata from Instagram, Twitter, Facebook, LinkedIn posts and generate professional PDF documents instantly. Free, fast, and easy to use.",
  keywords: ["PDF converter", "social media", "Instagram", "Twitter", "Facebook", "post to PDF", "image extractor"],
  authors: [{ name: "Post to PDF" }],
  creator: "Post to PDF",
  openGraph: {
    title: "Post to PDF - Convert Social Media Posts to PDFs",
    description: "Extract images and metadata from social media posts and generate professional PDFs instantly",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Post to PDF - Convert Social Media Posts to PDFs",
    description: "Extract images and metadata from social media posts and generate professional PDFs instantly",
  },
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
