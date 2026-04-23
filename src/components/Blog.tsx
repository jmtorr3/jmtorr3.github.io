import { useState, useEffect } from 'react'
import './Blog.css'

const API_URL = import.meta.env.VITE_BLOG_API_URL
const BLOG_URL = import.meta.env.VITE_BLOG_FRONTEND_URL

type Post = {
  id: string | number
  slug: string
  title: string
  description?: string
  cover_image_url?: string
  published_at?: string
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function PostCard({ post }: { post: Post }) {
  const href = BLOG_URL ? `${BLOG_URL}/post/${post.slug}` : '#'
  return (
    <a className="blog-card" href={href}>
      {post.cover_image_url && (
        <div className="blog-card-cover">
          <img src={post.cover_image_url} alt={post.title} loading="lazy" />
        </div>
      )}
      <div className="blog-card-body">
        <span className="blog-card-date">{formatDate(post.published_at || post.created_at)}</span>
        <h3 className="blog-card-title">{post.title}</h3>
        {post.description && <p className="blog-card-desc">{post.description}</p>}
      </div>
    </a>
  )
}

export default function Blog() {
  const [posts, setPosts] = useState<Post[] | null>(null)

  useEffect(() => {
    if (!API_URL) return
    fetch(`${API_URL}/api/posts/`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setPosts(data.slice(0, 4)))
      .catch(() => setPosts([]))
  }, [])

  // No API URL configured or fetch failed with no posts — hide entirely
  if (!API_URL || posts === null || posts.length === 0) return null

  return (
    <section id="blog" className="blog-section">
      <h2 className="section-title">Blog</h2>
      <div className="blog-grid">
        {posts.map(post => <PostCard key={post.id} post={post} />)}
      </div>
      {BLOG_URL && (
        <a className="blog-view-all" href={BLOG_URL} target="_blank" rel="noopener noreferrer">
          view all posts →
        </a>
      )}
    </section>
  )
}
