<template>
  <div class="blog-post">
    <div v-if="resolving && !isImportedEssay" class="blog-post">
      <p class="text-muted p-4">Loading...</p>
    </div>
    <div v-else-if="isImportedEssay" class="imported-essay">
      <router-link to="/blog" class="btn btn-outline-secondary mb-3">
        <i class="fas fa-arrow-left me-2"></i>
        Back to Media
      </router-link>
      <iframe
        class="essay-frame"
        :title="essayTitle"
        :src="essaySrc"
      ></iframe>
    </div>
    <div v-else class="container-fluid">
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
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { loadBlogSummaries } from '../utils/blogPosts.js'

export default {
  name: 'BlogPost',
  setup() {
    const route = useRoute()
    const resolving = ref(true)
    const essaySrc = ref('')
    const essayTitle = ref('Blog post')
    const isImportedEssay = computed(() => essaySrc.value !== '')
    const post = ref(null)
    const isLoading = ref(false)
    const error = ref('')
    const isBookmarked = ref(false)

    const loadPost = async () => {
      isLoading.value = true
      error.value = ''
      post.value = null
      error.value = 'Post not found'
      isLoading.value = false
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

    watch(() => route.params.slug, async (slug) => {
      resolving.value = true
      essaySrc.value = ''
      try {
        const posts = await loadBlogSummaries()
        const match = posts.find((item) => item.slug === slug && item.file)
        if (match) {
          essaySrc.value = match.file
          essayTitle.value = match.title || 'Blog post'
          return
        }
      } catch (err) {
        console.error('Error loading essay:', err)
      }
      loadPost()
    }, { immediate: true })

    watch(isImportedEssay, (ready) => {
      if (ready) resolving.value = false
    })
    watch(isLoading, (loading) => {
      if (!loading) resolving.value = false
    })

    return {
      resolving,
      isImportedEssay,
      essaySrc,
      essayTitle,
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
.imported-essay {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 1rem 1.25rem 0;
}

.essay-frame {
  flex: 1;
  width: 100%;
  min-height: 70vh;
  border: 0;
  border-radius: var(--radius);
  background: #0f172a;
}

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
