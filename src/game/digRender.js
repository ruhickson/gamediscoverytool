import {
  COLS,
  TILE,
  TILE_SIZE,
  VIEW_H,
  VIEW_ROWS,
  VIEW_W,
  cameraTop
} from './digWorld.js'

function hash(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawDirt(ctx, x, y, _sand, hc) {
  const px = x * TILE_SIZE
  const py = y * TILE_SIZE
  const pad = 1
  ctx.fillStyle = hc ? '#111' : '#141b22'
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  const base = hc ? '#d0d7de' : (hash(x, y) > 0.5 ? '#c5d0da' : '#aebbc8')
  ctx.fillStyle = base
  roundRect(ctx, px + pad, py + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2, 3)
  ctx.fill()
  ctx.fillStyle = hc ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)'
  ctx.fillRect(px + 4, py + TILE_SIZE - 7, TILE_SIZE - 8, 3)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  for (let i = 0; i < 4; i += 1) {
    const sx = px + 4 + hash(x + i * 3, y) * (TILE_SIZE - 10)
    const sy = py + 4 + hash(x, y + i * 5) * (TILE_SIZE - 12)
    ctx.fillRect(sx, sy, 2, 2)
  }
}

function drawOpen(ctx, x, y, hc) {
  const px = x * TILE_SIZE
  const py = y * TILE_SIZE
  ctx.fillStyle = hc ? '#000' : '#12181e'
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = hc ? '#222' : '#1c2630'
  ctx.fillRect(px, py + TILE_SIZE - 3, TILE_SIZE, 3)
}

function drawRock(ctx, x, y, hc) {
  const px = x * TILE_SIZE
  const py = y * TILE_SIZE
  ctx.fillStyle = hc ? '#000' : '#2a343e'
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  ctx.strokeStyle = hc ? '#fff' : '#3d4c5a'
  ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
}

function drawChoiceTile(ctx, x, y, hc) {
  drawDirt(ctx, x, y, true, hc)
}

function drawGreyTile(ctx, x, y, hc) {
  drawDirt(ctx, x, y, true, hc)
  ctx.fillStyle = hc ? 'rgba(255,255,255,0.35)' : 'rgba(10, 14, 18, 0.62)'
  ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
}

function paintSlotLabel(ctx, slot, hc, tone) {
  ctx.font = '600 12px Figtree, sans-serif'
  const x = slot.x0 * TILE_SIZE + 6
  const y = slot.y0 * TILE_SIZE + 4
  const w = (slot.x1 - slot.x0 + 1) * TILE_SIZE - 12
  const h = (slot.y1 - slot.y0 + 1) * TILE_SIZE - 8
  const label = `${slot.optionIndex + 1}. ${slot.label}`
  let fontSize = 12
  let lines = wrapLines(ctx, label, w - 8).slice(0, 3)
  while (fontSize > 9 && lines.some((line) => ctx.measureText(line).width > w - 4)) {
    fontSize -= 1
    ctx.font = `600 ${fontSize}px Figtree, sans-serif`
    lines = wrapLines(ctx, label, w - 8).slice(0, 3)
  }
  const lineH = fontSize + 2
  const blockH = lines.length * lineH
  const blockW = Math.min(w - 4, Math.max(...lines.map((line) => ctx.measureText(line).width), 0) + 16)
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.fillStyle = hc ? '#000' : 'rgba(16, 24, 32, 0.82)'
  roundRect(ctx, cx - blockW / 2, cy - blockH / 2 - 3, blockW, blockH + 6, 4)
  ctx.fill()
  let cursor = cy - ((lines.length - 1) * lineH) / 2
  ctx.fillStyle = hc ? '#fff' : tone
  for (const line of lines) {
    ctx.fillText(line, cx, cursor)
    cursor += lineH
  }
}

function drawChoiceLabels(ctx, world, hc) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const chamber of world.settled || []) {
    for (const slot of chamber.slots) {
      const chosen = slot.optionIndex === chamber.selected
      ctx.strokeStyle = hc ? '#fff' : (chosen ? 'rgba(126, 214, 154, 0.95)' : 'rgba(120, 132, 144, 0.45)')
      ctx.lineWidth = chosen ? 3 : 1
      ctx.strokeRect(slot.x0 * TILE_SIZE + 1.5, slot.y0 * TILE_SIZE + 1.5, (slot.x1 - slot.x0 + 1) * TILE_SIZE - 3, (slot.y1 - slot.y0 + 1) * TILE_SIZE - 3)
      paintSlotLabel(ctx, slot, hc, chosen ? '#8ee0a8' : '#8b98a4')
    }
  }
  if (world.choice && !world.choice.resolved) {
    for (const slot of world.choice.slots) {
      ctx.strokeStyle = hc ? '#fff' : 'rgba(180, 214, 232, 0.95)'
      ctx.lineWidth = world.choice.selected === slot.optionIndex ? 3 : 2
      ctx.strokeRect(slot.x0 * TILE_SIZE + 1.5, slot.y0 * TILE_SIZE + 1.5, (slot.x1 - slot.x0 + 1) * TILE_SIZE - 3, (slot.y1 - slot.y0 + 1) * TILE_SIZE - 3)
      paintSlotLabel(ctx, slot, hc, '#e7f2f8')
    }
  }
  ctx.restore()
}

function drawPlayer(ctx, world, time, hc) {
  const { x, y, facing, dugAt } = world.player
  const lunging = time - dugAt < 140
  const lunge = lunging ? 5 : 0
  const shift = { up: [0, -lunge], down: [0, lunge], left: [-lunge, 0], right: [lunge, 0] }[facing] || [0, 0]
  const cx = x * TILE_SIZE + TILE_SIZE / 2 + shift[0]
  const cy = y * TILE_SIZE + TILE_SIZE / 2 + Math.sin(time / 200) * 0.8 + shift[1]
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(cx, y * TILE_SIZE + TILE_SIZE - 6, 8, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hc ? '#fff' : '#f4e2c8'
  ctx.beginPath()
  ctx.arc(cx, cy + 2, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hc ? '#fff' : '#9eb4c6'
  ctx.beginPath()
  ctx.arc(cx, cy - 1, 8, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(cx - 8, cy - 2, 16, 3)
  ctx.fillStyle = hc ? '#000' : '#1c2630'
  ctx.fillRect(cx - 5, cy - 1, 10, 3)
  const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[facing] || Math.PI / 2
  const swing = lunging ? Math.sin(time / 30) * 0.45 : 0
  ctx.save()
  ctx.translate(cx, cy + 2)
  ctx.rotate(angle + swing)
  ctx.fillStyle = hc ? '#fff' : '#6d7c8a'
  ctx.fillRect(7, -1.5, 9, 3)
  ctx.fillStyle = hc ? '#fff' : '#d5dbe3'
  ctx.beginPath()
  ctx.moveTo(15, -5)
  ctx.lineTo(22, 0)
  ctx.lineTo(15, 5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function discoverBox(world) {
  const { x0, y0, x1, y1 } = world.discover
  return {
    x: x0 * TILE_SIZE + 2,
    y: y0 * TILE_SIZE + 2,
    w: (x1 - x0 + 1) * TILE_SIZE - 4,
    h: (y1 - y0 + 1) * TILE_SIZE - 4
  }
}

function drawSealedDiscover(ctx, world, time, hc, loading) {
  const box = discoverBox(world)
  ctx.fillStyle = hc ? '#000' : 'rgba(20, 28, 36, 0.55)'
  roundRect(ctx, box.x, box.y, box.w, box.h, 10)
  ctx.fill()
  if (loading && !hc) {
    const span = box.w + 80
    const sheen = ((time / 8) % span) - 40
    ctx.save()
    ctx.beginPath()
    roundRect(ctx, box.x, box.y, box.w, box.h, 10)
    ctx.clip()
    const gradient = ctx.createLinearGradient(box.x + sheen, box.y, box.x + sheen + 70, box.y + box.h)
    gradient.addColorStop(0, 'rgba(142, 195, 222, 0)')
    gradient.addColorStop(0.5, 'rgba(142, 195, 222, 0.38)')
    gradient.addColorStop(1, 'rgba(142, 195, 222, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(box.x, box.y, box.w, box.h)
    ctx.restore()
  }
  ctx.lineWidth = 3
  ctx.strokeStyle = hc ? '#fff' : '#8ec3de'
  ctx.stroke()
  drawCracks(ctx, box, world.cracks || 0, hc)
  const cx = box.x + box.w / 2
  ctx.fillStyle = hc ? '#fff' : '#e7f2f8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 18px Fraunces, Georgia, serif'
  const lines = wrapLines(ctx, 'discover your next games', box.w - 28)
  lines.forEach((line, index) => {
    ctx.fillText(line, cx, box.y + box.h / 2 - 16 + index * 22)
  })
  ctx.font = '12px Figtree, sans-serif'
  ctx.fillStyle = hc ? '#fff' : '#b7c9d6'
  const taps = `${world.cracks || 0} / 5 taps`
  ctx.fillText(loading ? `searching…  ${taps}` : taps, cx, box.y + box.h - 22)
}

function drawCracks(ctx, box, cracks, hc) {
  if (!cracks) return
  const paths = [
    [[0.18, 0.12], [0.34, 0.38], [0.28, 0.62]],
    [[0.72, 0.1], [0.58, 0.32], [0.66, 0.55]],
    [[0.42, 0.08], [0.48, 0.4], [0.4, 0.78]],
    [[0.12, 0.7], [0.36, 0.62], [0.3, 0.9]],
    [[0.8, 0.48], [0.62, 0.7], [0.74, 0.92]]
  ]
  ctx.save()
  ctx.strokeStyle = hc ? '#fff' : 'rgba(214, 228, 236, 0.9)'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  paths.slice(0, cracks).forEach((path) => {
    ctx.beginPath()
    path.forEach(([px, py], index) => {
      const x = box.x + px * box.w
      const y = box.y + py * box.h
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  })
  ctx.restore()
}

function drawOpenedDiscover(ctx, world, view, time) {
  const box = discoverBox(world)
  const hc = view.highContrast
  const age = Math.max(0, time - (world.brokenAt || time))
  ctx.fillStyle = hc ? '#000' : '#1a242e'
  roundRect(ctx, box.x, box.y, box.w, box.h, 10)
  ctx.fill()
  ctx.strokeStyle = hc ? '#fff' : '#8ec3de'
  ctx.lineWidth = 3
  ctx.stroke()
  if (age < 280) {
    ctx.strokeStyle = hc ? '#fff' : 'rgba(183, 201, 214, 0.8)'
    ctx.beginPath()
    ctx.moveTo(box.x + 20, box.y + 10)
    ctx.lineTo(box.x + box.w * 0.45, box.y + box.h * 0.55)
    ctx.lineTo(box.x + box.w - 16, box.y + box.h - 12)
    ctx.stroke()
  }
  const hits = []
  const innerX = box.x + 10
  const innerW = box.w - 20
  let cursorY = box.y + 12
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  if (view.phase === 'searching' || (world.broken && !view.games.length && !view.error && !view.shortfall)) {
    const dots = '.'.repeat(1 + Math.floor(time / 280) % 3)
    ctx.fillStyle = hc ? '#fff' : '#e7f2f8'
    ctx.font = '600 16px Fraunces, Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Searching${dots}`, box.x + box.w / 2, box.y + box.h / 2 - 8)
    return hits
  }
  if (view.error) {
    ctx.fillStyle = '#f87171'
    ctx.font = '13px Figtree, sans-serif'
    const lines = wrapLines(ctx, view.error, innerW)
    lines.slice(0, 6).forEach((line) => {
      ctx.fillText(line, innerX, cursorY)
      cursorY += 16
    })
    return hits
  }
  const games = view.games || []
  const gap = 6
  const shortfallH = view.shortfall ? 48 : 0
  const cardH = Math.max(72, box.h - 24 - shortfallH)
  const cardW = games.length
    ? (innerW - gap * (games.length - 1)) / games.length
    : innerW
  const cam = cameraTop(world)
  games.forEach((game, index) => {
    const x = innerX + index * (cardW + gap)
    ctx.fillStyle = hc ? '#000' : '#24323e'
    roundRect(ctx, x, cursorY, cardW, cardH, 6)
    ctx.fill()
    ctx.strokeStyle = hc ? '#fff' : 'rgba(142, 195, 222, 0.55)'
    ctx.lineWidth = 1
    ctx.stroke()
    const linkY = cursorY + cardH - 26
    ctx.save()
    ctx.beginPath()
    ctx.rect(x + 4, cursorY + 4, cardW - 8, Math.max(24, linkY - cursorY - 10))
    ctx.clip()
    ctx.fillStyle = hc ? '#fff' : '#e7f2f8'
    ctx.font = '600 24px Figtree, sans-serif'
    const nameLines = wrapLines(ctx, game.name, cardW - 16).slice(0, 3)
    let textY = cursorY + 10
    nameLines.forEach((line) => {
      ctx.fillText(line, x + 8, textY)
      textY += 28
    })
    const titleBottom = textY
    ctx.font = '15px Figtree, sans-serif'
    ctx.fillStyle = hc ? '#fff' : '#b7c9d6'
    const meta = [game.reviewScoreDesc, game.releaseDate, `${game.totalReviews.toLocaleString('en-US')} reviews`]
      .filter(Boolean)
    const metaLines = wrapLines(ctx, meta.join(' · '), cardW - 16).slice(0, 3)
    textY += 4
    metaLines.forEach((line) => {
      ctx.fillText(line, x + 8, textY)
      textY += 18
    })
    ctx.restore()
    ctx.fillStyle = hc ? '#fff' : '#8ec3de'
    ctx.font = '600 16px Figtree, sans-serif'
    ctx.fillText('Steam', x + 8, linkY)
    ctx.fillText('ITAD', x + 70, linkY)
    hits.push({
      x: x + 4,
      y: linkY - 4 - cam * TILE_SIZE,
      w: 58,
      h: 24,
      url: game.url
    })
    hits.push({
      x: x + 66,
      y: linkY - 4 - cam * TILE_SIZE,
      w: 52,
      h: 24,
      url: game.itadUrl
    })
    hits.push({
      x: x + 4,
      y: cursorY + 6 - cam * TILE_SIZE,
      w: cardW - 8,
      h: Math.max(28, titleBottom - cursorY - 6),
      url: game.url
    })
  })
  cursorY += cardH + 8
  if (view.shortfall) {
    ctx.fillStyle = hc ? '#fff' : '#c5d4e0'
    ctx.font = '18px Figtree, sans-serif'
    const lead = view.shortfall.pending
      ? `${view.shortfall.count} game${view.shortfall.count === 1 ? '' : 's'} matched, fewer than 3. Finding which constraint emptied the list…`
      : `${view.shortfall.count} game${view.shortfall.count === 1 ? '' : 's'} matched, fewer than 3. The constraint that emptied the list: ${view.shortfall.constraint}.`
    const lines = wrapLines(ctx, lead, innerW)
    lines.slice(0, 5).forEach((line) => {
      ctx.fillText(line, innerX, cursorY)
      cursorY += 22
    })
  }
  return hits
}

export function drawFrame(ctx, view) {
  const { world, time } = view
  const hc = !!view.highContrast
  const cam = cameraTop(world)
  const shake = Math.max(0, 1 - (time - world.player.dugAt) / 120)
  ctx.clearRect(0, 0, VIEW_W, VIEW_H)
  ctx.fillStyle = hc ? '#000' : '#1b242c'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  ctx.save()
  ctx.translate(Math.sin(time / 20) * 1.5 * shake, 0)
  ctx.translate(0, -cam * TILE_SIZE)
  for (let y = cam; y < Math.min(world.rows.length, cam + VIEW_ROWS + 1); y += 1) {
    const row = world.rows[y]
    if (!row) continue
    for (let x = 0; x < COLS; x += 1) {
      const tile = row[x]
      if (tile === TILE.ROCK) drawRock(ctx, x, y, hc)
      else if (tile === TILE.DIRT) drawDirt(ctx, x, y, false, hc)
      else if (tile === TILE.SAND) drawDirt(ctx, x, y, true, hc)
      else if (tile === TILE.CHOICE) drawChoiceTile(ctx, x, y, hc)
      else if (tile === TILE.GREY) drawGreyTile(ctx, x, y, hc)
      else if (tile === TILE.DISCOVER) drawDirt(ctx, x, y, true, hc)
      else drawOpen(ctx, x, y, hc)
    }
  }
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, 1 - particle.age / particle.life)
    ctx.fillStyle = particle.color
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
  }
  ctx.globalAlpha = 1
  drawChoiceLabels(ctx, world, hc)
  let hits = []
  if (world.discover && !world.broken) {
    drawSealedDiscover(ctx, world, time, hc, !!view.loading)
    drawPlayer(ctx, world, time, hc)
  } else {
    drawPlayer(ctx, world, time, hc)
    if (world.discover && world.broken) hits = drawOpenedDiscover(ctx, world, view, time)
  }
  ctx.restore()
  return { gameHits: hits }
}

export { VIEW_W, VIEW_H, TILE_SIZE }
