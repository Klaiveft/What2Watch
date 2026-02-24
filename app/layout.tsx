import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'What2Watch',
  description: 'Propose movies and swipe to vote for movie night!',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
