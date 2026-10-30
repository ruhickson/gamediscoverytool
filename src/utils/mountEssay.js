const SCOPE = '.imported-essay'
const STYLE_ID = 'imported-essay-css'

function scopeCss(css, scope) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{([^{}]*)\}/g, (match, selector, body) => {
    const trimmed = selector.trim()
    if (!trimmed || trimmed.startsWith('@')) return match
    if (/^(from|to|\d+(\.\d+)?%)$/.test(trimmed)) return match
    const prefixed = trimmed.split(',').map((part) => {
      const sel = part.trim()
      if (!sel || sel.startsWith(`${scope} `) || sel === scope) return sel
      if (sel === ':root' || sel === 'html' || sel === 'body') return scope
      if (/^(html|body)(?=[\s>+~])/.test(sel)) return scope + sel.replace(/^(html|body)/, '')
      return `${scope} ${sel}`
    }).join(', ')
    return `${prefixed}{${body}}`
  })
}

function ensureStyle(css) {
  let style = document.getElementById(STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = css
}

async function loadClassicScript(src) {
  if (document.querySelector(`script[data-essay-src="${src}"]`)) return
  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.dataset.essaySrc = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

function isFrameBounce(code) {
  return code.includes('window.top') && code.includes('window.self')
}

export async function mountEssay(host, url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load ${url}`)
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
  const sheets = []
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute('href')
    if (!href) continue
    if (/fonts\.(googleapis|gstatic)\.com/.test(href)) {
      if (!document.querySelector(`link[data-essay-font="${href}"]`)) {
        const font = document.createElement('link')
        font.rel = 'stylesheet'
        font.href = href
        font.dataset.essayFont = href
        document.head.appendChild(font)
      }
      continue
    }
    const css = await fetch(href).then((res) => res.text())
    sheets.push(scopeCss(css, SCOPE))
  }
  for (const style of doc.querySelectorAll('style')) {
    sheets.push(scopeCss(style.textContent || '', SCOPE))
  }
  ensureStyle(sheets.join('\n'))
  const scripts = [...doc.querySelectorAll('script')]
  doc.body.querySelectorAll('script').forEach((script) => script.remove())
  host.innerHTML = doc.body.innerHTML

  const resizeCleanups = []
  const originalAdd = window.addEventListener.bind(window)
  window.addEventListener = (type, listener, options) => {
    if (type === 'resize') resizeCleanups.push(() => window.removeEventListener(type, listener, options))
    return originalAdd(type, listener, options)
  }
  try {
    for (const old of scripts) {
      const code = old.textContent || ''
      if (isFrameBounce(code)) continue
      if (old.src) {
        await loadClassicScript(old.src)
        continue
      }
      if (!code.trim()) continue
      const script = document.createElement('script')
      script.textContent = `(() => {\n${code}\n})();`
      document.body.appendChild(script)
      script.remove()
    }
  } finally {
    window.addEventListener = originalAdd
  }

  return () => {
    resizeCleanups.forEach((remove) => remove())
    host.innerHTML = ''
  }
}
