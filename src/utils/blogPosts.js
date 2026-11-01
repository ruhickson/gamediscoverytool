const POSTS = [
  {
    slug: '2026-11-01-diclosure-day-ais-takeover-of-steam',
    publishedAt: '2026-11-01',
    draft: false,
    file: '/blog/2026-11-01-disclosure-day-ais-takeover-of-steam.html'
  },
  {
    slug: '2026-10-22-four-years-after-vampire-survivors',
    publishedAt: '2026-10-22',
    file: '/blog/2026-10-22-four-years-after-vampire-survivors.html'
  },
  {
    slug: '2026-10-28-farewell-bioware-the-impact-of-mass-effect',
    publishedAt: '2026-10-28',
    draft: true,
    file: '/blog/2026-10-28-farewell-bioware-the-impact-of-mass-effect.html'
  }
]

function textOf(node) {
  return (node?.textContent || '').replace(/\s+/g, ' ').trim()
}

export async function loadBlogSummaries({ includeDrafts = false } = {}) {
  const posts = includeDrafts ? POSTS : POSTS.filter((post) => !post.draft)
  const summaries = await Promise.all(posts.map(async (post) => {
    const response = await fetch(post.file)
    if (!response.ok) throw new Error(`Failed to load ${post.file}`)
    const html = await response.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return {
      ...post,
      title: textOf(doc.querySelector('h1')),
      excerpt: textOf(doc.querySelector('p.lede')),
      kicker: textOf(doc.querySelector('.kicker')),
      featuredImage: doc.querySelector('img.hero')?.getAttribute('src') || ''
    }
  }))
  return summaries
}
