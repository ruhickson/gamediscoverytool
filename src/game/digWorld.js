export const COLS = 21
export const TILE_SIZE = 32
export const VIEW_ROWS = 12
export const VIEW_W = COLS * TILE_SIZE
export const VIEW_H = VIEW_ROWS * TILE_SIZE

export const TILE = {
  ROCK: 'rock',
  DIRT: 'dirt',
  SAND: 'sand',
  OPEN: 'open',
  CHOICE: 'choice',
  GREY: 'grey',
  DISCOVER: 'discover'
}

const CHOICE_ROWS = 3

function chamberSpans(count) {
  const inner = COLS - 2
  const safe = Math.max(1, count)
  const base = Math.floor(inner / safe)
  let extra = inner - base * safe
  const spans = []
  let x = 1
  for (let i = 0; i < safe; i += 1) {
    const width = Math.max(1, base + (extra > 0 ? 1 : 0))
    if (extra > 0) extra -= 1
    spans.push([x, x + width - 1])
    x += width
  }
  return spans
}

function walled(fill) {
  const row = Array.from({ length: COLS }, () => fill)
  row[0] = TILE.ROCK
  row[COLS - 1] = TILE.ROCK
  return row
}

export function makeWorld() {
  const rows = [Array(COLS).fill(TILE.ROCK)]
  rows.push(walled(TILE.OPEN))
  rows.push(walled(TILE.OPEN))
  return {
    rows,
    player: { x: 10, y: 2, facing: 'down', dugAt: 0 },
    choice: null,
    discover: null,
    settled: [],
    cracks: 0,
    crackAt: 0,
    discoverHeld: false,
    reachedDiscover: false,
    broken: false,
    brokenAt: 0,
    particles: []
  }
}

export function appendGround(world, depth = 4) {
  for (let i = 0; i < depth; i += 1) {
    const y = world.rows.length
    const row = Array.from({ length: COLS }, (_, x) => {
      if (x === 0 || x === COLS - 1) return TILE.ROCK
      return TILE.SAND
    })
    world.rows.push(row)
  }
}

export function appendEncounter(world, options) {
  const list = Array.isArray(options)
    ? options
    : Array.from({ length: Number(options) || 0 }, (_, index) => ({ label: String(index + 1) }))
  world.rows.push(walled(TILE.OPEN))
  const approachY = world.rows.length - 1
  const y0 = world.rows.length
  for (let i = 0; i < CHOICE_ROWS; i += 1) world.rows.push(walled(TILE.OPEN))
  const y1 = y0 + CHOICE_ROWS - 1
  const slots = chamberSpans(list.length).map(([x0, x1], optionIndex) => {
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) world.rows[y][x] = TILE.CHOICE
    }
    return {
      x0,
      x1,
      y0,
      y1,
      optionIndex,
      label: list[optionIndex]?.label || String(optionIndex + 1)
    }
  })
  world.choice = {
    y: y0,
    y0,
    y1,
    approachY,
    slots,
    resolved: false,
    selected: -1
  }
}

export function appendDiscover(world) {
  world.rows.push(walled(TILE.OPEN))
  const lipY = world.rows.length - 1
  const y0 = world.rows.length
  for (let i = 0; i < 8; i += 1) {
    const row = walled(TILE.DISCOVER)
    row[1] = TILE.OPEN
    row[COLS - 2] = TILE.OPEN
    world.rows.push(row)
  }
  const y1 = world.rows.length - 1
  world.rows.push(Array(COLS).fill(TILE.ROCK))
  world.discover = { y0, y1, x0: 2, x1: COLS - 3, lipY }
}

export function resolveChoice(world) {
  if (!world.choice || world.choice.resolved) return
  const selected = world.choice.selected
  for (const slot of world.choice.slots) {
    const chosen = slot.optionIndex === selected
    for (let y = slot.y0; y <= slot.y1; y += 1) {
      for (let x = slot.x0; x <= slot.x1; x += 1) {
        if (!world.rows[y]) continue
        const tile = world.rows[y][x]
        if (tile !== TILE.CHOICE && tile !== TILE.OPEN) continue
        world.rows[y][x] = chosen ? TILE.OPEN : TILE.GREY
      }
    }
  }
  world.settled.push({
    slots: world.choice.slots.map((slot) => ({ ...slot })),
    selected
  })
  world.choice.resolved = true
}

export function choiceIndexAt(world, x, y) {
  if (!world.choice || world.choice.resolved) return -1
  const slot = world.choice.slots.find((entry) => (
    x >= entry.x0 && x <= entry.x1 && y >= entry.y0 && y <= entry.y1
  ))
  return slot ? slot.optionIndex : -1
}

export const DISCOVER_TAPS = 5

export function tapDiscover(world) {
  if (!world?.discover || world.broken) return { open: false }
  const now = performance.now()
  if (now - (world.crackAt || 0) < 160) return { open: false }
  world.cracks = Math.min(DISCOVER_TAPS, (world.cracks || 0) + 1)
  world.crackAt = now
  world.player.dugAt = now
  const { x0, x1, y0, y1 } = world.discover
  spawnBurst(world, Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2))
  if (world.cracks >= DISCOVER_TAPS) {
    world.broken = true
    world.brokenAt = now
    return { open: true, cracks: world.cracks }
  }
  return { open: false, cracks: world.cracks }
}

export function isDiscoverTile(world, x, y) {
  if (!world.discover) return false
  const { x0, x1, y0, y1 } = world.discover
  return x >= x0 && x <= x1 && y >= y0 && y <= y1
}

export function cameraTop(world) {
  const max = Math.max(0, world.rows.length - VIEW_ROWS)
  let desired = world.player.y - 5
  if (world.discover && world.player.y >= world.discover.lipY - 1) {
    desired = world.discover.y0 - 2
  }
  return Math.max(0, Math.min(max, desired))
}

function spawnBurst(world, x, y) {
  const colors = ['#d5dee6', '#b7c3ce', '#8ec3de']
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4
    const speed = 30 + Math.random() * 70
    world.particles.push({
      x: (x + 0.5) * TILE_SIZE,
      y: (y + 0.35) * TILE_SIZE,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 380,
      age: 0,
      color: colors[i % colors.length],
      size: 2 + Math.random() * 3
    })
  }
  if (world.particles.length > 240) {
    world.particles.splice(0, world.particles.length - 240)
  }
}

export function updateParticles(world, dt) {
  const step = dt / 1000
  const next = []
  for (const particle of world.particles) {
    particle.age += dt
    if (particle.age >= particle.life) continue
    particle.vy += 320 * step
    particle.x += particle.vx * step
    particle.y += particle.vy * step
    next.push(particle)
  }
  world.particles = next
}

export function tryMove(world, dir) {
  const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
  if (!delta || world.broken) return { moved: false }
  const nx = world.player.x + delta[0]
  const ny = world.player.y + delta[1]
  const row = world.rows[ny]
  if (!row || nx < 0 || nx >= COLS) return { moved: false }
  const tile = row[nx]
  if (tile === TILE.CHOICE) {
    const index = choiceIndexAt(world, nx, ny)
    if (index < 0 || world.choice.pending) return { moved: false, blocked: tile }
    world.choice.pending = true
    world.choice.selected = index
    spawnBurst(world, nx, ny)
    world.player.x = nx
    world.player.y = ny
    world.player.dugAt = performance.now()
    world.player.facing = dir
    return { moved: true, dug: true, chose: index }
  }
  if (tile === TILE.DISCOVER) {
    if (world.broken || world.discoverHeld) return { moved: false, blocked: tile }
    world.discoverHeld = true
    world.reachedDiscover = true
    world.player.facing = dir
    const tapped = tapDiscover(world)
    return { moved: false, dug: true, discover: tapped.open }
  }
  if (tile === TILE.ROCK || tile === TILE.GREY) {
    return { moved: false, blocked: tile }
  }
  const dug = tile === TILE.DIRT || tile === TILE.SAND
  if (dug) {
    row[nx] = TILE.OPEN
    spawnBurst(world, nx, ny)
    world.player.dugAt = performance.now()
  }
  world.player.x = nx
  world.player.y = ny
  world.player.facing = dir
  if (world.discover && ny === world.discover.lipY) world.reachedDiscover = true
  return { moved: true, dug }
}

function canCross(tile) {
  return tile === TILE.OPEN || tile === TILE.SAND || tile === TILE.DIRT
}

export function steerToChoice(world, index) {
  if (!world.choice || world.choice.resolved || world.choice.pending) return { moved: false }
  const slot = world.choice.slots.find((entry) => entry.optionIndex === index)
  if (!slot) return { moved: false }
  const targetX = Math.floor((slot.x0 + slot.x1) / 2)
  const approachY = world.choice.approachY
  const px = world.player.x
  const py = world.player.y
  if (px >= slot.x0 && px <= slot.x1 && py >= slot.y0 && py <= slot.y1) {
    return { arrived: true, chose: index }
  }
  if (py > approachY) return tryMove(world, 'up')
  if (py < approachY) {
    if (px !== targetX) {
      const dir = px < targetX ? 'right' : 'left'
      const nx = px + (dir === 'right' ? 1 : -1)
      if (canCross(world.rows[py]?.[nx])) return tryMove(world, dir)
    }
    const below = world.rows[py + 1]?.[px]
    if (!canCross(below) && below !== undefined && px !== targetX) return { moved: false, blocked: below }
    return tryMove(world, 'down')
  }
  if (px !== targetX) return tryMove(world, px < targetX ? 'right' : 'left')
  return tryMove(world, 'down')
}

export function steerToDiscover(world) {
  if (!world.discover || world.broken) return { moved: false }
  const targetX = Math.floor((world.discover.x0 + world.discover.x1) / 2)
  const lipY = world.discover.lipY
  const px = world.player.x
  const py = world.player.y
  const onBox = px >= world.discover.x0 && px <= world.discover.x1
    && py >= world.discover.y0 && py <= world.discover.y1
  if (onBox) {
    world.reachedDiscover = true
    return { arrived: true }
  }
  if (py === lipY && px === targetX) {
    world.player.x = targetX
    world.player.y = world.discover.y0
    world.player.facing = 'down'
    world.reachedDiscover = true
    return { arrived: true }
  }
  if (py > lipY) return tryMove(world, 'up')
  if (py < lipY) {
    if (px !== targetX) {
      const dir = px < targetX ? 'right' : 'left'
      const nx = px + (dir === 'right' ? 1 : -1)
      if (canCross(world.rows[py]?.[nx])) return tryMove(world, dir)
    }
    const below = world.rows[py + 1]?.[px]
    if (below === TILE.DISCOVER && px === targetX) {
      world.player.x = targetX
      world.player.y = world.discover.y0
      world.player.facing = 'down'
      world.reachedDiscover = true
      return { arrived: true }
    }
    if (!canCross(below) && below !== undefined) return { moved: false, blocked: below }
    return tryMove(world, 'down')
  }
  return tryMove(world, px < targetX ? 'right' : 'left')
}
