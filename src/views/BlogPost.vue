<template>
  <div class="blog-post">
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <!-- Back to Blog -->
          <div class="mb-3">
            <router-link to="/blog" class="btn btn-outline-secondary">
              <i class="fas fa-arrow-left me-2"></i>
              Back to Blog
            </router-link>
          </div>

          <div class="card">
            <div class="card-body">
              <!-- Loading State -->
              <div v-if="isLoading" class="text-center py-5">
                <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                <p>Loading blog post...</p>
              </div>
              
              <!-- Error State -->
              <div v-else-if="error" class="alert alert-danger">
                {{ error }}
              </div>
              
              <!-- Blog Post Content -->
              <article v-else-if="post" class="blog-post-content">
                <!-- Header -->
                <header class="blog-post-header mb-4">
                  <h1 class="blog-post-title">{{ post.title }}</h1>
                  
                  <div class="blog-post-meta mb-3">
                    <div class="row align-items-center">
                      <div class="col-md-8">
                        <span class="text-muted me-3">
                          <i class="fas fa-calendar me-1"></i>
                          {{ formatDate(post.publishedAt) }}
                        </span>
                        <span class="text-muted me-3">
                          <i class="fas fa-user me-1"></i>
                          {{ post.author }}
                        </span>
                        <span class="text-muted me-3">
                          <i class="fas fa-clock me-1"></i>
                          {{ post.readTime }} min read
                        </span>
                        <span class="text-muted">
                          <i class="fas fa-tag me-1"></i>
                          {{ post.category }}
                        </span>
                      </div>
                      <div class="col-md-4 text-md-end">
                        <div class="blog-post-actions">
                          <button class="btn btn-outline-primary btn-sm me-2" @click="sharePost">
                            <i class="fas fa-share me-1"></i>
                            Share
                          </button>
                          <button class="btn btn-outline-secondary btn-sm" @click="toggleBookmark">
                            <i class="fas" :class="isBookmarked ? 'fa-bookmark' : 'fa-bookmark-o'"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Featured Image -->
                  <div v-if="post.featuredImage" class="blog-post-featured-image mb-4">
                    <img 
                      :src="post.featuredImage" 
                      :alt="post.title"
                      class="img-fluid rounded"
                    >
                  </div>
                </header>
                
                <!-- Content -->
                <div class="blog-post-body">
                  <div v-html="renderedContent"></div>
                </div>
                
                <!-- Tags -->
                <div v-if="post.tags && post.tags.length > 0" class="blog-post-tags mt-4">
                  <h6>Tags:</h6>
                  <div class="tag-list">
                    <span 
                      v-for="tag in post.tags" 
                      :key="tag"
                      class="tag-badge"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
                
                <!-- Share Section -->
                <div class="blog-post-share mt-4 pt-4 border-top">
                  <h6>Share this post:</h6>
                  <div class="share-buttons">
                    <button class="btn btn-outline-primary btn-sm me-2" @click="shareOnTwitter">
                      <i class="fab fa-twitter me-1"></i>
                      Twitter
                    </button>
                    <button class="btn btn-outline-primary btn-sm me-2" @click="shareOnFacebook">
                      <i class="fab fa-facebook me-1"></i>
                      Facebook
                    </button>
                    <button class="btn btn-outline-primary btn-sm me-2" @click="shareOnLinkedIn">
                      <i class="fab fa-linkedin me-1"></i>
                      LinkedIn
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" @click="copyLink">
                      <i class="fas fa-link me-1"></i>
                      Copy Link
                    </button>
                  </div>
                </div>
              </article>
              
              <!-- Post Not Found -->
              <div v-else class="text-center py-5">
                <i class="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                <h3>Post Not Found</h3>
                <p class="text-muted">The blog post you're looking for doesn't exist or has been removed.</p>
                <router-link to="/blog" class="btn btn-primary">
                  Back to Blog
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

export default {
  name: 'BlogPost',
  setup() {
    const route = useRoute()
    const post = ref(null)
    const isLoading = ref(false)
    const error = ref('')
    const isBookmarked = ref(false)

    // Mock data - replace with actual API calls
    const mockPosts = [
      {
        id: 1,
        title: "How to Discover Hidden Gems in Steam",
        slug: "discover-hidden-gems-steam",
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
        readTime: 5,
        category: "Tips & Guides",
        tags: ["Steam", "Discovery", "Indie Games", "Tips"],
        featuredImage: "/api/placeholder/800/400"
      }
    ]

    const loadPost = async () => {
      isLoading.value = true
      error.value = ''
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const slug = route.params.slug
        const foundPost = mockPosts.find(p => p.slug === slug)
        
        if (foundPost) {
          post.value = foundPost
        } else {
          error.value = 'Post not found'
        }
      } catch (err) {
        error.value = 'Failed to load blog post'
        console.error('Error loading post:', err)
      } finally {
        isLoading.value = false
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const renderedContent = computed(() => {
      if (!post.value) return ''
      
      // Simple markdown to HTML conversion (in production, use a proper markdown parser)
      return post.value.content
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n\n/gim, '</p><p>')
        .replace(/^(.*)$/gim, '<p>$1</p>')
    })

    const sharePost = () => {
      if (navigator.share) {
        navigator.share({
          title: post.value.title,
          text: post.value.excerpt,
          url: window.location.href
        })
      } else {
        copyLink()
      }
    }

    const shareOnTwitter = () => {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.value.title)}&url=${encodeURIComponent(window.location.href)}`
      window.open(url, '_blank')
    }

    const shareOnFacebook = () => {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`
      window.open(url, '_blank')
    }

    const shareOnLinkedIn = () => {
      const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`
      window.open(url, '_blank')
    }

    const copyLink = () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        // Show success message
        console.log('Link copied to clipboard')
      })
    }

    const toggleBookmark = () => {
      isBookmarked.value = !isBookmarked.value
      // In production, save to localStorage or user account
    }

    onMounted(() => {
      loadPost()
    })

    return {
      post,
      isLoading,
      error,
      isBookmarked,
      formatDate,
      renderedContent,
      sharePost,
      shareOnTwitter,
      shareOnFacebook,
      shareOnLinkedIn,
      copyLink,
      toggleBookmark
    }
  }
}
</script>

<style scoped>
.blog-post-title {
  font-size: 2.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  color: var(--pixel-text);
}

.blog-post-meta {
  font-size: 0.9rem;
}

.blog-post-featured-image img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
}

.blog-post-body {
  font-size: 1.1rem;
  line-height: 1.8;
  color: var(--pixel-text);
}

.blog-post-body h1,
.blog-post-body h2,
.blog-post-body h3 {
  color: var(--pixel-cyan);
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.blog-post-body h1 {
  font-size: 2rem;
}

.blog-post-body h2 {
  font-size: 1.5rem;
}

.blog-post-body h3 {
  font-size: 1.25rem;
}

.blog-post-body ul {
  margin-left: 2rem;
}

.blog-post-body li {
  margin-bottom: 0.5rem;
}

.blog-post-tags .tag-badge {
  display: inline-block;
  background-color: var(--pixel-light-bg);
  color: var(--pixel-text);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  margin-right: 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--pixel-border);
}

.share-buttons .btn {
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .blog-post-title {
    font-size: 2rem;
  }
  
  .blog-post-meta .row > div {
    margin-bottom: 0.5rem;
  }
}
</style>
