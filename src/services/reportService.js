import axios from 'axios'

const endpoint = '/.netlify/functions/report-error'

async function submitReport({ subject, message, token }) {
  const payload = { subject, message, token }
  const { data } = await axios.post(endpoint, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
  })
  if (!data?.ok) {
    const err = data?.error || 'Submission failed'
    throw new Error(err)
  }
  return data
}

export default { submitReport }




