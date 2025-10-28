<template>
  <div class="container py-4">
    <h2 class="mb-3">Report an Issue</h2>
    <p class="text-muted">See something wrong? Let us know.</p>

    <form @submit.prevent="handleSubmit" class="mt-3" novalidate>
      <div class="mb-3">
        <label for="subject" class="form-label">Subject</label>
        <select id="subject" v-model="form.subject" class="form-select" required>
          <option disabled value="">Select a subject</option>
          <option value="missing tags">Missing tags</option>
          <option value="wrong name">Wrong name</option>
          <option value="wrong score">Wrong score</option>
          <option value="missing game">Missing game</option>
        </select>
      </div>

      <div class="mb-3">
        <label for="message" class="form-label">Details</label>
        <textarea
          id="message"
          v-model="form.message"
          class="form-control"
          rows="5"
          maxlength="1000"
          placeholder="Please provide short details (max 1000 characters)."
          required
        ></textarea>
        <div class="form-text">Max 1000 characters.</div>
      </div>

      <div class="mb-3">
        <div id="hcaptcha-container">
          <div
            class="h-captcha"
            :data-sitekey="hcaptchaSiteKey"
            :data-callback="onCaptchaSuccessName"
          ></div>
        </div>
        <small v-if="captchaError" class="text-danger">Please complete the captcha.</small>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button type="submit" class="btn btn-primary" :disabled="submitting">
          {{ submitting ? 'Sending...' : 'Submit' }}
        </button>
        <span v-if="successMessage" class="text-success">{{ successMessage }}</span>
        <span v-if="errorMessage" class="text-danger">{{ errorMessage }}</span>
      </div>
    </form>
  </div>
</template>

<script>
import { onMounted, ref } from 'vue'
import reportService from '../services/reportService'

export default {
  name: 'ReportIssue',
  setup() {
    const form = ref({ subject: '', message: '' })
    const submitting = ref(false)
    const successMessage = ref('')
    const errorMessage = ref('')
    const captchaToken = ref('')
    const captchaError = ref(false)
    const hcaptchaSiteKey = import.meta.env.VITE_HCAPTCHA_SITEKEY || ''

    const onCaptchaSuccess = token => {
      captchaToken.value = token
      captchaError.value = false
    }

    const onCaptchaSuccessName = 'onCaptchaSuccessGlobal'

    const ensureHCaptchaScript = () => {
      if (document.querySelector('script[src="https://js.hcaptcha.com/1/api.js"]')) return
      const s = document.createElement('script')
      s.src = 'https://js.hcaptcha.com/1/api.js'
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }

    onMounted(() => {
      // expose callback globally for hCaptcha
      window[onCaptchaSuccessName] = onCaptchaSuccess
      ensureHCaptchaScript()
    })

    const resetForm = () => {
      form.value = { subject: '', message: '' }
      captchaToken.value = ''
      try {
        if (window.hcaptcha) window.hcaptcha.reset()
      } catch (e) {}
    }

    const handleSubmit = async () => {
      successMessage.value = ''
      errorMessage.value = ''

      if (!form.value.subject || !form.value.message) {
        errorMessage.value = 'Please fill in all fields.'
        return
      }
      if (!captchaToken.value) {
        captchaError.value = true
        errorMessage.value = 'Please complete the captcha.'
        return
      }

      submitting.value = true
      try {
        await reportService.submitReport({
          subject: form.value.subject,
          message: form.value.message,
          token: captchaToken.value
        })
        successMessage.value = 'Thanks! Your report has been sent.'
        resetForm()
      } catch (err) {
        errorMessage.value = err?.message || 'Failed to send. Please try again later.'
      } finally {
        submitting.value = false
      }
    }

    return {
      form,
      submitting,
      successMessage,
      errorMessage,
      captchaError,
      hcaptchaSiteKey,
      onCaptchaSuccessName,
      handleSubmit
    }
  }
}
</script>

<style scoped>
.container {
  max-width: 760px;
}
</style>




