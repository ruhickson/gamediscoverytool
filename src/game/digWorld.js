export const COLS = 13
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
  DISCOVER: 'discover'
}

const CHOICE_X = {
  3: [3, 6, 9],
  4: [2, 5, 8, 11],
  5: [2, 4, 6, 8, 10]
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
    player: { x: 6, y: 2, facing: 'down', dugAt: 0 },
    choice: null,
    discover: null,
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
      return (x + y) % 2 === 0 ? TILE.DIRT : TILE.SAND
    })
    world.rows.push(row)
  }
}

export function appendEncounter(world, optionCount) {
  world.rows.push(walled(TILE.OPEN))
  const approachY = world.rows.length - 1
  const xs = CHOICE_X[optionCount] || CHOICE_X[3]
  const row = walled(TILE.OPEN)
  const slots = xs.map((x, optionIndex) => {
    row[x] = TILE.CHOICE
    return { x, optionIndex }
  })
  world.rows.push(row)
  world.choice = {
    y: world.rows.length - 1,
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
  for (let i = 0; i < 6; i += 1) {
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
  if (!world.choice) return
  for (const slot of world.choice.slots) {
    world.rows[world.choice.y][slot.x] = TILE.OPEN
  }
  world.choice.resolved = true
  world.choice.selected = -1
}

export function choiceIndexAt(world, x, y) {
  if (!world.choice || world.choice.resolved || y !== world.choice.y) return -1
  const slot = world.choice.slots.find((entry) => entry.x === x)
  return slot ? slot.optionIndex : -1
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

function spawnBurst(world, x, y, tile) {
  const colors = tile === TILE.SAND
    ? ['#f3ddb0', '#e6c98a', '#c4a15a']
    : ['#a8683c', '#6e4224', '#d7b56a']
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
  if (world.choice && !world.choice.resolved && world.player.y === world.choice.approachY) {
    return { moved: false, paused: true }
  }
  const nx = world.player.x + delta[0]
  const ny = world.player.y + delta[1]
  const row = world.rows[ny]
  if (!row || nx < 0 || nx >= COLS) return { moved: false }
  const tile = row[nx]
  if (tile === TILE.ROCK || tile === TILE.CHOICE || tile === TILE.DISCOVER) {
    return { moved: false, blocked: tile }
  }
  const dug = tile === TILE.DIRT || tile === TILE.SAND
  if (dug) {
    row[nx] = TILE.OPEN
    spawnBurst(world, nx, ny, tile)
    world.player.dugAt = performance.now()
  }
  world.player.x = nx
  world.player.y = ny
  world.player.facing = dir
  const paused = !!(world.choice && !world.choice.resolved && ny === world.choice.approachY)
  if (world.discover && ny === world.discover.lipY) world.reachedDiscover = true
  return { moved: true, dug, paused }
}
