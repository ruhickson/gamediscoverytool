const nodemailer = require('nodemailer')

async function verifyHCaptcha(token) {
  const secret = process.env.HCAPTCHA_SECRET
  if (!secret) {
    throw new Error('Server misconfiguration: HCAPTCHA_SECRET is missing')
  }
  const params = new URLSearchParams()
  params.append('response', token || '')
  params.append('secret', secret)
  const res = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })
  const data = await res.json()
  return !!data.success
}

function sanitize(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 1200)
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) }
  }

  try {
    const { subject, message, token } = JSON.parse(event.body || '{}')
    const allowed = new Set(['missing tags', 'wrong name', 'wrong score', 'missing game'])
    if (!allowed.has(subject) || !message || !token) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid payload' }) }
    }

    const captchaOk = await verifyHCaptcha(token)
    if (!captchaOk) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Captcha failed' }) }
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10)
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const mailTo = process.env.MAIL_TO || 'topohaihai@gmail.com'
    const mailFrom = process.env.MAIL_FROM || smtpUser || 'noreply@gamediscoverytool.com'

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error('Server misconfiguration: SMTP credentials missing')
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    })

    const safeSubject = `[Game Discovery Report] ${sanitize(subject)}`
    const safeMessage = sanitize(message)
    const text = `New issue reported\nSubject: ${subject}\n\nMessage:\n${safeMessage}`

    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      subject: safeSubject,
      text
    })

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'Server error' }) }
  }
}














