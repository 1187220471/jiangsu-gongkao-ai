import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '独行侠波铁 - AI面试训练',
  description: '江苏省公务员面试AI智能训练平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
