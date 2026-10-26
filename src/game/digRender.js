import {
  COLS,
  TILE,
  TILE_SIZE,
  VIEW_H,
  VIEW_ROWS,
  VIEW_W,
  cameraTop
} from './digWorld.js'

const CHOICE_COLORS = ['#d4533a', '#3d7ea6', '#d4af37', '#6f9a45', '#8d62b8']

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

function drawDirt(ctx, x, y, sand, hc) {
  const px = x * TILE_SIZE
  const py = y * TILE_SIZE
  const pad = 1
  ctx.fillStyle = hc ? '#111' : (sand ? '#1a140c' : '#140e0a')
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  const base = hc
    ? (sand ? '#c8b48a' : '#8a5a32')
    : (sand ? (hash(x, y) > 0.5 ? '#e6c98a' : '#d7b56a') : (hash(x, y) > 0.5 ? '#7a4b2a' : '#6b4124'))
  ctx.fillStyle = base
  roundRect(ctx, px + pad, py + pad, TILE_SIZE - pad * 2, TILE_SIZE - pad * 2, 3)
  ctx.fill()
  ctx.fillStyle = hc ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.18)'
  ctx.fillRect(px + 4, py + TILE_SIZE - 7, TILE_SIZE - 8, 3)
  ctx.fillStyle = sand ? 'rgba(255,255,255,0.28)' : 'rgba(255,220,170,0.18)'
  for (let i = 0; i < 4; i += 1) {
    const sx = px + 4 + hash(x + i * 3, y) * (TILE_SIZE - 10)
    const sy = py + 4 + hash(x, y + i * 5) * (TILE_SIZE - 12)
    ctx.fillRect(sx, sy, sand ? 2 : 3, sand ? 2 : 2)
  }
}

function drawOpen(ctx, x, y, hc) {
  const px = x * TILE_SIZE
  const py = y * TILE_SIZE
  ctx.fillStyle = hc ? '#000' : '#120e0b'
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = hc ? '#222' : '#1c1510'
  ctx.fillRect(px, py + TILE_SIZE - 3, TILE_SIZE, 3)
}

function drawRock(ctx, x, y, hc) {
  const px = x * TILE_SIZE
  const py = y * TILE_SIZE
  ctx.fillStyle = hc ? '#000' : '#241810'
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  ctx.strokeStyle = hc ? '#fff' : '#3a2a1e'
  ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
}

function drawChoice(ctx, x, y, index, selected, active, time, hc) {
  const px = x * TILE_SIZE
  const py = y * TILE_SIZE
  const pulse = active ? 1 + Math.sin(time / 180) * 0.06 : 1
  const size = (TILE_SIZE - 4) * pulse
  const ox = px + (TILE_SIZE - size) / 2
  const oy = py + (TILE_SIZE - size) / 2
  ctx.fillStyle = hc ? '#000' : CHOICE_COLORS[index % CHOICE_COLORS.length]
  roundRect(ctx, ox, oy, size, size, 5)
  ctx.fill()
  ctx.lineWidth = selected ? 3 : 2
  ctx.strokeStyle = hc ? '#fff' : 'rgba(255,255,255,0.85)'
  ctx.stroke()
  ctx.fillStyle = hc ? '#fff' : '#1a120c'
  ctx.font = 'bold 16px Figtree, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(index + 1), px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 1)
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
  ctx.fillStyle = hc ? '#fff' : '#e2b340'
  ctx.beginPath()
  ctx.arc(cx, cy - 1, 8, Math.PI, 0)
  ctx.fill()
  ctx.fillRect(cx - 8, cy - 2, 16, 3)
  ctx.fillStyle = hc ? '#000' : '#2b2418'
  ctx.fillRect(cx - 5, cy - 1, 10, 3)
  const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[facing] || Math.PI / 2
  const swing = lunging ? Math.sin(time / 30) * 0.45 : 0
  ctx.save()
  ctx.translate(cx, cy + 2)
  ctx.rotate(angle + swing)
  ctx.fillStyle = hc ? '#fff' : '#8d6a43'
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

function drawSealedDiscover(ctx, world, time, hc) {
  const box = discoverBox(world)
  ctx.fillStyle = hc ? '#000' : '#1f6f54'
  roundRect(ctx, box.x, box.y, box.w, box.h, 10)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = hc ? '#fff' : '#e6c45a'
  ctx.stroke()
  const cx = box.x + box.w / 2
  const cy = box.y + 36 + Math.sin(time / 280) * 2
  ctx.fillStyle = hc ? '#fff' : '#b8f3d8'
  ctx.beginPath()
  ctx.moveTo(cx, cy - 16)
  ctx.lineTo(cx + 14, cy - 4)
  ctx.lineTo(cx + 9, cy + 16)
  ctx.lineTo(cx - 9, cy + 16)
  ctx.lineTo(cx - 14, cy - 4)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = hc ? '#fff' : '#f6f1e4'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 18px Fraunces, Georgia, serif'
  const lines = wrapLines(ctx, 'discover your next games', box.w - 28)
  lines.forEach((line, index) => {
    ctx.fillText(line, cx, box.y + box.h / 2 + 16 + index * 22)
  })
  ctx.font = '12px Figtree, sans-serif'
  ctx.fillStyle = hc ? '#fff' : '#d7f5e8'
  ctx.fillText('click to break open', cx, box.y + box.h - 22)
}

function drawOpenedDiscover(ctx, world, view, time) {
  const box = discoverBox(world)
  const hc = view.highContrast
  const age = Math.max(0, time - (world.brokenAt || time))
  ctx.fillStyle = hc ? '#000' : '#10241c'
  roundRect(ctx, box.x, box.y, box.w, box.h, 10)
  ctx.fill()
  ctx.strokeStyle = hc ? '#fff' : '#e6c45a'
  ctx.lineWidth = 3
  ctx.stroke()
  if (age < 280) {
    ctx.strokeStyle = hc ? '#fff' : 'rgba(230,196,90,0.8)'
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
    ctx.fillStyle = hc ? '#fff' : '#f6f1e4'
    ctx.font = '600 16px Fraunces, Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Breaking open…', box.x + box.w / 2, box.y + box.h / 2 - 8)
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
  ctx.font = '600 13px Figtree, sans-serif'
  games.forEach((game) => {
    const cardH = 48
    ctx.fillStyle = hc ? '#000' : '#17382c'
    roundRect(ctx, innerX, cursorY, innerW, cardH, 6)
    ctx.fill()
    ctx.strokeStyle = hc ? '#fff' : 'rgba(230,196,90,0.45)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = hc ? '#fff' : '#f6f1e4'
    ctx.font = '600 13px Figtree, sans-serif'
    const name = game.name.length > 42 ? `${game.name.slice(0, 40)}…` : game.name
    ctx.fillText(name, innerX + 8, cursorY + 6)
    ctx.font = '11px Figtree, sans-serif'
    ctx.fillStyle = hc ? '#fff' : '#d7f5e8'
    const meta = [game.reviewScoreDesc, game.releaseDate, `${game.totalReviews.toLocaleString('en-US')} reviews`]
      .filter(Boolean)
      .join(' · ')
    ctx.fillText(meta, innerX + 8, cursorY + 26)
    const cam = cameraTop(world)
    hits.push({
      x: innerX,
      y: cursorY - cam * TILE_SIZE,
      w: innerW,
      h: cardH,
      url: game.url
    })
    cursorY += cardH + 6
  })
  if (view.shortfall) {
    ctx.fillStyle = hc ? '#fff' : '#f6d98a'
    ctx.font = '12px Figtree, sans-serif'
    const lead = view.shortfall.pending
      ? `${view.shortfall.count} game${view.shortfall.count === 1 ? '' : 's'} matched, fewer than 3. Finding which constraint emptied the list…`
      : `${view.shortfall.count} game${view.shortfall.count === 1 ? '' : 's'} matched, fewer than 3. The constraint that emptied the list: ${view.shortfall.constraint}.`
    const lines = wrapLines(ctx, lead, innerW)
    lines.slice(0, 5).forEach((line) => {
      ctx.fillText(line, innerX, cursorY)
      cursorY += 15
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
  ctx.fillStyle = hc ? '#000' : '#1a120c'
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
      else if (tile === TILE.CHOICE) {
        drawOpen(ctx, x, y, hc)
        const slot = world.choice?.slots.find((entry) => entry.x === x && world.choice.y === y)
        const index = slot ? slot.optionIndex : 0
        const active = world.choice && !world.choice.resolved && world.choice.y === y
        drawChoice(ctx, x, y, index, world.choice?.selected === index, active, time, hc)
      } else if (tile === TILE.DISCOVER) {
        drawOpen(ctx, x, y, hc)
      } else {
        drawOpen(ctx, x, y, hc)
      }
    }
  }
  for (const particle of world.particles) {
    ctx.globalAlpha = Math.max(0, 1 - particle.age / particle.life)
    ctx.fillStyle = particle.color
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
  }
  ctx.globalAlpha = 1
  drawPlayer(ctx, world, time, hc)
  let hits = []
  if (world.discover && !world.broken) drawSealedDiscover(ctx, world, time, hc)
  if (world.discover && world.broken) hits = drawOpenedDiscover(ctx, world, view, time)
  ctx.restore()
  return { gameHits: hits }
}

export { VIEW_W, VIEW_H, TILE_SIZE }
