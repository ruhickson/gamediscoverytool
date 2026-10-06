<template>
  <div class="blog">
    <div class="container-fluid">
      <div class="row">
        <div class="col-12">
          <div class="card">
            <div class="card-header">
              <h2 class="mb-0">
                <i class="fas fa-blog me-2"></i>
                Game Discovery Blog
              </h2>
              <p class="text-muted mb-0">Latest news, tips, and insights about game discovery</p>
            </div>
            <div class="card-body">
              <!-- Blog Posts List -->
              <div v-if="isLoading" class="text-center py-4">
                <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                <p>Loading blog posts...</p>
              </div>
              
              <div v-else-if="error" class="alert alert-danger">
                {{ error }}
              </div>
              
              <div v-else-if="posts.length === 0" class="text-center py-4">
                <i class="fas fa-newspaper fa-3x mb-3 text-muted"></i>
                <p class="text-muted">No blog posts yet. Check back soon!</p>
              </div>
              
              <div v-else class="blog-posts">
                <div 
                  v-for="post in posts" 
                  :key="post.id" 
                  class="blog-post-card card mb-4"
                >
                  <div class="card-body">
                    <div class="row">
                      <div class="col-md-8">
                        <h3 class="blog-post-title">
                          <router-link :to="`/blog/${post.slug}`" class="text-decoration-none">
                            {{ post.title }}
                          </router-link>
                        </h3>
                        <p class="blog-post-excerpt text-muted">
                          {{ post.excerpt }}
                        </p>
                        <div class="blog-post-meta">
                          <span class="text-muted">
                            <i class="fas fa-calendar me-1"></i>
                            {{ formatDate(post.publishedAt) }}
                          </span>
                          <span class="text-muted ms-3">
                            <i class="fas fa-user me-1"></i>
                            {{ post.author }}
                          </span>
                          <span class="text-muted ms-3">
                            <i class="fas fa-clock me-1"></i>
                            {{ post.readTime }} min read
                          </span>
                        </div>
                      </div>
                      <div class="col-md-4">
                        <img 
                          v-if="post.featuredImage" 
                          :src="post.featuredImage" 
                          :alt="post.title"
                          class="blog-post-image img-fluid rounded"
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Pagination -->
              <nav v-if="totalPages > 1" aria-label="Blog pagination">
                <ul class="pagination justify-content-center">
                  <li class="page-item" :class="{ disabled: currentPage === 1 }">
                    <button class="page-link" @click="goToPage(currentPage - 1)">
                      <i class="fas fa-chevron-left"></i>
                    </button>
                  </li>
                  
                  <li 
                    v-for="page in visiblePages" 
                    :key="page"
                    class="page-item" 
                    :class="{ active: page === currentPage }"
                  >
                    <button class="page-link" @click="goToPage(page)">
                      {{ page }}
                    </button>
                  </li>
                  
                  <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                    <button class="page-link" @click="goToPage(currentPage + 1)">
                      <i class="fas fa-chevron-right"></i>
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'

export default {
  name: 'Blog',
  setup() {
    const posts = ref([])
    const isLoading = ref(false)
    const error = ref('')
    const currentPage = ref(1)
    const totalPages = ref(1)
    const postsPerPage = 6

    // Mock data - replace with actual API calls
    const mockPosts = [
      {
        id: 1,
        title: "How to Discover Hidden Gems in Steam",
        slug: "discover-hidden-gems-steam",
        excerpt: "Learn advanced techniques for finding amazing games that aren't in the top charts.",
        content: "# How to Discover Hidden Gems in Steam\n\nSteam has thousands of games...",
        author: "Game Discovery Team",
        publishedAt: "2024-10-03T10:00:00Z",
        readTime: 5,
        featuredImage: "/api/placeholder/400/200"
      },
      {
        id: 2,
        title: "The Science Behind Game Recommendations",
        slug: "science-game-recommendations",
        excerpt: "Understanding how our recommendation algorithm works to find your perfect games.",
        content: "# The Science Behind Game Recommendations\n\nOur algorithm considers...",
        author: "Game Discovery Team",
        publishedAt: "2024-10-01T14:30:00Z",
        readTime: 8,
        featuredImage: "/api/placeholder/400/200"
      },
      {
        id: 3,
        title: "Top 10 Indie Games You Might Have Missed",
        slug: "top-10-indie-games-missed",
        excerpt: "A curated list of incredible indie games that deserve more attention.",
        content: "# Top 10 Indie Games You Might Have Missed\n\nIndie games often...",
        author: "Game Discovery Team",
        publishedAt: "2024-09-28T09:15:00Z",
        readTime: 12,
        featuredImage: "/api/placeholder/400/200"
      }
    ]

    const loadPosts = async () => {
      isLoading.value = true
      error.value = ''
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Mock pagination
        const startIndex = (currentPage.value - 1) * postsPerPage
        const endIndex = startIndex + postsPerPage
        posts.value = mockPosts.slice(startIndex, endIndex)
        totalPages.value = Math.ceil(mockPosts.length / postsPerPage)
      } catch (err) {
        error.value = 'Failed to load blog posts'
        console.error('Error loading posts:', err)
      } finally {
        isLoading.value = false
      }
    }

    const goToPage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        loadPosts()
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const visiblePages = computed(() => {
      const pages = []
      const start = Math.max(1, currentPage.value - 2)
      const end = Math.min(totalPages.value, currentPage.value + 2)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      return pages
    })

    onMounted(() => {
      loadPosts()
    })

    return {
      posts,
      isLoading,
      error,
      currentPage,
      totalPages,
      goToPage,
      formatDate,
      visiblePages
    }
  }
}
</script>

<style scoped>
.blog-post-card {
  transition: all 0.2s ease;
}

.blog-post-card:hover {
  box-shadow: var(--shadow-md);
}

.blog-post-title {
  font-size: 1.5rem;
  margin-bottom: var(--spacing-md);
}

.blog-post-title a {
  color: var(--color-text);
  transition: color 0.2s ease;
  text-decoration: none;
}

.blog-post-title a:hover {
  color: var(--color-accent);
}

.blog-post-excerpt {
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: var(--spacing-md);
}

.blog-post-meta {
  font-size: 0.9rem;
}

.blog-post-image {
  max-height: 200px;
  object-fit: cover;
  border-radius: var(--radius);
}

.pagination .page-link {
  background-color: var(--color-bg);
  border-color: var(--color-border);
  color: var(--color-text);
  transition: all 0.2s ease;
}

.pagination .page-link:hover {
  background-color: var(--color-bg-alt);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.pagination .page-item.active .page-link {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: #ffffff;
}

.pagination .page-item.disabled .page-link {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
