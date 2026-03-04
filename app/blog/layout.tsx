import { notFound } from 'next/navigation'
import { isBlogEnabled } from '@/lib/blogConfig'

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!isBlogEnabled()) {
    notFound()
  }
  return <>{children}</>
}
