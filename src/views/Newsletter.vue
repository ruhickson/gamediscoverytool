<template>
  <div class="newsletter">
    <div class="card">
      <div class="card-header">
        <h5><i class="fas fa-envelope"></i> Newsletter</h5>
      </div>
      <div class="card-body info-section">
        <h4>Weekly game picks, curated for you</h4>
        <p>
          With nearly 10,000 games released each month, it's hard to keep on top of enjoyable
          releases that are worth your time. Every week we recommend six games — chosen for
          quality, novelty, style, and fun.
        </p>
        <p>
          Five picks come from the last two months; one is a gem from at least five years ago
          that you may have missed. Subscribe below to get them in your inbox. No spam —
          unsubscribe any time.
        </p>

        <div v-if="!buttondownUsername" class="alert alert-warning mt-4 mb-0">
          Newsletter signup is not configured yet. Set
          <code>VITE_BUTTONDOWN_USERNAME</code> in your environment.
        </div>

        <template v-else>
          <form
            :action="formAction"
            method="post"
            class="embeddable-buttondown-form mt-4"
          >
            <div class="mb-3">
              <label for="email" class="form-label">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                class="form-control"
                placeholder="you@example.com"
                autocomplete="email"
                required
              />
            </div>
            <input type="hidden" value="1" name="embed" />
            <button type="submit" class="btn btn-primary">Subscribe</button>
            <p class="text-muted small mt-3 mb-0">
              <a href="https://buttondown.com" target="_blank" rel="noopener noreferrer">
                Powered by Buttondown.
              </a>
            </p>
          </form>

          <p class="text-muted small mt-3 mb-0">
            Or subscribe on
            <a :href="newsletterUrl" target="_blank" rel="noopener noreferrer">Buttondown</a>.
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'Newsletter',
  setup() {
    const buttondownUsername = import.meta.env.VITE_BUTTONDOWN_USERNAME || ''

    const formAction = computed(() =>
      `https://buttondown.com/api/emails/embed-subscribe/${buttondownUsername}`
    )

    const newsletterUrl = computed(() => `https://buttondown.com/${buttondownUsername}`)

    return {
      buttondownUsername,
      formAction,
      newsletterUrl
    }
  }
}
</script>
