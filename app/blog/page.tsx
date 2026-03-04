'use client'

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import Blog from '@/components/Blog'
import { useAuth } from '@/components/AuthProvider'
import { isArticleSearchEnabled } from '@/lib/blogConfig'

export default function BlogPage() {
  const { user, userAccount } = useAuth()
  const isLoggedIn = !!user
  const userName = userAccount?.username ?? ''
  const userAvatar = userAccount?.avatar_url ?? ''

  return (
    <div className="blog-page-wrapper">
      <Navbar />
      <Blog
        isLoggedIn={isLoggedIn}
        userName={userName}
        userAvatar={userAvatar}
        searchEnabled={isArticleSearchEnabled()}
      />
      <Footer />
    </div>
  )
}
