// Blog Service - Handles blog content management
import axios from 'axios'

// For now, we'll use mock data. In production, this would connect to a CMS or API
const API_BASE_URL = import.meta.env.VITE_BLOG_API_URL || '/api/blog'

const blogClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Mock blog data - replace with actual API calls
const mockBlogPosts = [
  {
    id: 1,
    title: "How to Discover Hidden Gems in Steam",
    slug: "discover-hidden-gems-steam",
    excerpt: "Learn advanced techniques for finding amazing games that aren't in the top charts.",
    content: `# How to Discover Hidden Gems in Steam

Steam has thousands of games, and while the top charts are great, some of the best gaming experiences are hidden gems that don't get the attention they deserve. Here's how to find them:

## 1. Use Advanced Search Filters

Steam's search functionality is more powerful than most people realize:

- **Filter by user reviews**: Look for games with "Very Positive" or "Overwhelmingly Positive" reviews
- **Sort by release date**: Find recent indie releases
- **Use tags creatively**: Combine specific tags like "atmospheric" + "indie" + "singleplayer"

## 2. Check Curator Recommendations

Steam Curators are a great way to discover games:

- Follow curators with similar taste to yours
- Look for niche curators focusing on specific genres
- Check curator reviews for detailed insights

## 3. Explore the Discovery Queue

Steam's Discovery Queue algorithm learns from your preferences:

- Rate games you've played
- Add games to your wishlist
- The algorithm will suggest similar games

## 4. Use External Tools

Tools like our Game Discovery Tool can help you find games based on:

- Similar gameplay mechanics
- Shared tags and themes
- User review patterns
- Developer portfolios

## Conclusion

Finding hidden gems takes time and effort, but the reward is discovering amazing games that most people never hear about. Start with these techniques and you'll soon have a library full of unique gaming experiences.`,
    author: "Game Discovery Team",
    publishedAt: "2024-10-03T10:00:00Z",
    updatedAt: "2024-10-03T10:00:00Z",
    readTime: 5,
    category: "Tips & Guides",
    tags: ["Steam", "Discovery", "Indie Games", "Tips"],
    featuredImage: "/api/placeholder/800/400",
    status: "published"
  },
  {
    id: 2,
    title: "The Science Behind Game Recommendations",
    slug: "science-game-recommendations",
    excerpt: "Understanding how our recommendation algorithm works to find your perfect games.",
    content: `# The Science Behind Game Recommendations

Our recommendation algorithm uses advanced machine learning techniques to match you with games you'll love. Here's how it works:

## Collaborative Filtering

We analyze patterns from millions of users to find games that people with similar tastes enjoy:

- **User-based filtering**: "Users who liked X also liked Y"
- **Item-based filtering**: "Games similar to X"
- **Matrix factorization**: Finding hidden patterns in user preferences

## Content-Based Filtering

We analyze game features to recommend similar titles:

- **Genre analysis**: Action, RPG, Strategy, etc.
- **Tag matching**: Atmospheric, Indie, Singleplayer
- **Developer patterns**: Games from studios you enjoy
- **Release date preferences**: New releases vs. classics

## Hybrid Approach

Our algorithm combines multiple techniques:

1. **Content analysis** of game features
2. **User behavior** patterns
3. **Review sentiment** analysis
4. **Temporal factors** like seasonal preferences

## Machine Learning Models

We use several ML models:

- **Neural networks** for complex pattern recognition
- **Random forests** for feature importance
- **Gradient boosting** for prediction accuracy
- **Deep learning** for user embedding

## Continuous Improvement

Our algorithm learns and improves over time:

- **A/B testing** different recommendation strategies
- **User feedback** integration
- **Performance monitoring** and optimization
- **New feature** experimentation

## Privacy and Ethics

We prioritize user privacy:

- **Data anonymization** techniques
- **Opt-out** options for data collection
- **Transparent** recommendation explanations
- **Fair** and unbiased algorithms

The result? Personalized game recommendations that help you discover your next favorite game.`,
    author: "Game Discovery Team",
    publishedAt: "2024-10-01T14:30:00Z",
    updatedAt: "2024-10-01T14:30:00Z",
    readTime: 8,
    category: "Technology",
    tags: ["Algorithm", "Machine Learning", "Recommendations", "Technology"],
    featuredImage: "/api/placeholder/800/400",
    status: "published"
  },
  {
    id: 3,
    title: "Top 10 Indie Games You Might Have Missed",
    slug: "top-10-indie-games-missed",
    excerpt: "A curated list of incredible indie games that deserve more attention.",
    content: `# Top 10 Indie Games You Might Have Missed

Indie games often fly under the radar, but they offer some of the most innovative and creative gaming experiences. Here are 10 incredible indie games you might have missed:

## 1. Celeste

**Genre**: Platformer  
**Why it's great**: Perfect platforming mechanics with an emotional story about mental health.

## 2. Hollow Knight

**Genre**: Metroidvania  
**Why it's great**: Beautiful hand-drawn art, challenging combat, and a vast interconnected world.

## 3. Stardew Valley

**Genre**: Farming Simulator  
**Why it's great**: Relaxing gameplay with deep character relationships and progression.

## 4. Cuphead

**Genre**: Run and Gun  
**Why it's great**: Unique 1930s cartoon art style with challenging boss battles.

## 5. Dead Cells

**Genre**: Roguelike Metroidvania  
**Why it's great**: Fast-paced combat with procedurally generated levels and permadeath.

## 6. Ori and the Blind Forest

**Genre**: Platformer  
**Why it's great**: Stunning visuals, emotional story, and fluid platforming mechanics.

## 7. Hades

**Genre**: Roguelike Action  
**Why it's great**: Excellent combat, engaging story, and high replayability.

## 8. Undertale

**Genre**: RPG  
**Why it's great**: Unique combat system, memorable characters, and multiple endings.

## 9. A Hat in Time

**Genre**: 3D Platformer  
**Why it's great**: Charming characters, creative level design, and nostalgic 3D platforming.

## 10. Gris

**Genre**: Platformer  
**Why it's great**: Beautiful watercolor art style and emotional journey through grief.

## How to Discover More Indie Games

1. **Follow indie developers** on social media
2. **Check indie game showcases** and events
3. **Use our Game Discovery Tool** to find similar games
4. **Read indie game blogs** and reviews
5. **Join indie game communities** and forums

These games prove that you don't need a massive budget to create amazing gaming experiences. Give them a try and discover the creativity of independent developers!`,
    author: "Game Discovery Team",
    publishedAt: "2024-09-28T09:15:00Z",
    updatedAt: "2024-09-28T09:15:00Z",
    readTime: 12,
    category: "Reviews",
    tags: ["Indie Games", "Reviews", "Top 10", "Gaming"],
    featuredImage: "/api/placeholder/800/400",
    status: "published"
  }
]

export const blogService = {
  // Get all published blog posts with pagination
  async getPosts(page = 1, limit = 6, category = null, tag = null) {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      let filteredPosts = mockBlogPosts.filter(post => post.status === 'published')
      
      // Filter by category
      if (category) {
        filteredPosts = filteredPosts.filter(post => 
          post.category.toLowerCase() === category.toLowerCase()
        )
      }
      
      // Filter by tag
      if (tag) {
        filteredPosts = filteredPosts.filter(post => 
          post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        )
      }
      
      // Sort by published date (newest first)
      filteredPosts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      
      // Pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const posts = filteredPosts.slice(startIndex, endIndex)
      
      return {
        posts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(filteredPosts.length / limit),
          totalPosts: filteredPosts.length,
          hasNext: endIndex < filteredPosts.length,
          hasPrev: page > 1
        }
      }
    } catch (error) {
      console.error('Error fetching blog posts:', error)
      throw error
    }
  },

  // Get a single blog post by slug
  async getPostBySlug(slug) {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const post = mockBlogPosts.find(p => p.slug === slug && p.status === 'published')
      
      if (!post) {
        throw new Error('Post not found')
      }
      
      return post
    } catch (error) {
      console.error('Error fetching blog post:', error)
      throw error
    }
  },

  // Get related posts
  async getRelatedPosts(postId, limit = 3) {
    try {
      const currentPost = mockBlogPosts.find(p => p.id === postId)
      if (!currentPost) return []
      
      // Find posts with similar tags or category
      const relatedPosts = mockBlogPosts.filter(p => 
        p.id !== postId && 
        p.status === 'published' &&
        (p.category === currentPost.category || 
         p.tags.some(tag => currentPost.tags.includes(tag)))
      )
      
      // Sort by relevance and limit results
      return relatedPosts
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, limit)
    } catch (error) {
      console.error('Error fetching related posts:', error)
      return []
    }
  },

  // Get blog categories
  async getCategories() {
    try {
      const categories = [...new Set(mockBlogPosts.map(post => post.category))]
      return categories.sort()
    } catch (error) {
      console.error('Error fetching categories:', error)
      return []
    }
  },

  // Get blog tags
  async getTags() {
    try {
      const tags = [...new Set(mockBlogPosts.flatMap(post => post.tags))]
      return tags.sort()
    } catch (error) {
      console.error('Error fetching tags:', error)
      return []
    }
  },

  // Search blog posts
  async searchPosts(query, page = 1, limit = 6) {
    try {
      if (!query.trim()) {
        return this.getPosts(page, limit)
      }
      
      const searchQuery = query.toLowerCase()
      const filteredPosts = mockBlogPosts.filter(post => 
        post.status === 'published' &&
        (post.title.toLowerCase().includes(searchQuery) ||
         post.excerpt.toLowerCase().includes(searchQuery) ||
         post.content.toLowerCase().includes(searchQuery) ||
         post.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
      )
      
      // Sort by relevance (title matches first, then content)
      filteredPosts.sort((a, b) => {
        const aTitleMatch = a.title.toLowerCase().includes(searchQuery)
        const bTitleMatch = b.title.toLowerCase().includes(searchQuery)
        
        if (aTitleMatch && !bTitleMatch) return -1
        if (!aTitleMatch && bTitleMatch) return 1
        
        return new Date(b.publishedAt) - new Date(a.publishedAt)
      })
      
      // Pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const posts = filteredPosts.slice(startIndex, endIndex)
      
      return {
        posts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(filteredPosts.length / limit),
          totalPosts: filteredPosts.length,
          hasNext: endIndex < filteredPosts.length,
          hasPrev: page > 1
        }
      }
    } catch (error) {
      console.error('Error searching blog posts:', error)
      throw error
    }
  }
}

export default blogService
