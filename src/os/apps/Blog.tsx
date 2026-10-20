import { useEffect, useState } from 'react'
import { blog } from '../../data/blog'

type Post = {
  id: string | number
  slug: string
  title: string
  description?: string
  cover_image_url?: string
  published_at?: string
  created_at: string
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

// 16×16 pixel cone: two white bands, darker right edge, gray base
const CONE = (() => {
  const px: { x: number; y: number; c: string }[] = []
  for (let y = 0; y < 13; y++) {
    const w = 1 + Math.floor((y * 5) / 12)
    for (let x = 8 - w; x < 8 + w; x++) {
      const band = y === 3 || y === 4 || y === 8 || y === 9
      const edge = x === 8 + w - 1
      px.push({ x, y, c: band ? (edge ? '#c2c3c7' : '#fff1e8') : edge ? '#c24d0c' : '#ff7a1a' })
    }
  }
  for (let x = 1; x < 15; x++) px.push({ x, y: 13, c: '#5f574f' })
  for (let x = 0; x < 16; x++) px.push({ x, y: 14, c: '#3b3632' })
  return px
})()

function UnderConstruction() {
  return (
    <div className="construction">
      <div className="caution-tape" />
      <div className="construction-body">
        <svg className="cone" viewBox="0 0 16 15" shapeRendering="crispEdges" aria-hidden>
          {CONE.map((p) => (
            <rect key={`${p.x},${p.y}`} x={p.x} y={p.y} width={1} height={1} fill={p.c} />
          ))}
        </svg>
        <div className="cone-shadow" />
        <h2 className="construction-title">{blog.constructionTitle}</h2>
        <p className="muted">{blog.constructionMessage}</p>
      </div>
      <div className="caution-tape" />
    </div>
  )
}

export function Blog() {
  return blog.underConstruction ? <UnderConstruction /> : <Posts />
}

function Posts() {
  const [posts, setPosts] = useState<Post[] | null>(null)

  useEffect(() => {
    if (!blog.apiUrl) return setPosts([])
    fetch(`${blog.apiUrl}/api/posts/`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: Post[]) => setPosts(data.slice(0, blog.maxPosts)))
      .catch(() => setPosts([]))
  }, [])

  return (
    <div className="blog">
      <div className="toolbar">
        <div className="address">{blog.url}</div>
        <a className="btn" href={blog.url} target="_blank" rel="noreferrer">
          open ↗
        </a>
      </div>
      <div className="blog-body">
        {posts === null && <p className="muted">loading posts…</p>}
        {posts?.length === 0 && (
          <p>
            Posts live on my blog: <a href={blog.url} target="_blank" rel="noreferrer">{blog.url}</a>
          </p>
        )}
        {posts?.map((post) => (
          <a key={post.id} className="card post" href={blog.postUrl(post.slug)} target="_blank" rel="noreferrer">
            {post.cover_image_url && <img src={post.cover_image_url} alt="" loading="lazy" />}
            <span className="muted small">{fmt(post.published_at || post.created_at)}</span>
            <strong>{post.title}</strong>
            {post.description && <span className="muted">{post.description}</span>}
          </a>
        ))}
      </div>
    </div>
  )
}
