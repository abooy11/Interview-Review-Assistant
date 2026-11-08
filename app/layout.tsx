import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Faculty_Glyphic } from "next/font/google"
import "./globals.css"
import { publicPath } from "@/lib/public-path"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const _facultyGlyphic = Faculty_Glyphic({ subsets: ["latin"], weight: ["400"] })

export const metadata: Metadata = {
  title: "面试复盘助手",
  description: "面试复盘助手",
  icons: {
    icon: [
      {
        url: publicPath("/icon-light-32x32.png"),
        media: "(prefers-color-scheme: light)",
      },
      {
        url: publicPath("/icon-dark-32x32.png"),
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: publicPath("/icon.svg"),
        type: "image/svg+xml",
      },
    ],
    apple: publicPath("/apple-icon.png"),
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
