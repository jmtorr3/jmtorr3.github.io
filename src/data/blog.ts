// Blog window. Posts are fetched from personal-blog's API when VITE_BLOG_API_URL is set
// (see .env.example); otherwise the window just links to the blog.
// While `underConstruction` is true the window only shows the safety-cone page.
export const blog = {
  underConstruction: true,
  constructionTitle: 'Under Reconstruction',
  constructionMessage: 'The blog is being rebuilt. Check back soon!',
  url: 'https://blog.sys32ent.com/',
  apiUrl: import.meta.env.VITE_BLOG_API_URL as string | undefined,
  postUrl: (slug: string) => `${import.meta.env.VITE_BLOG_FRONTEND_URL ?? 'https://blog.sys32ent.com'}/post/${slug}`,
  maxPosts: 6,
}
