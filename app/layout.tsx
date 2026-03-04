import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import { AuthProvider } from '@/components/AuthProvider'
import DebugAuth from '@/components/DebugAuth'
import Toast from '@/components/ui/Toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Responsive Web Template',
  description: 'A clean, modern, content-driven platform template',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <DebugAuth />
          {children}
          <Toast />
        </AuthProvider>
      </body>
    </html>
  )
}