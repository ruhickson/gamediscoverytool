<template>
  <div class="dig-page">
    <header class="dig-intro">
      <h1>Dig</h1>
      <p>
        Knock away dirt and sand. Each stop adds one choice to a Find a Game search.
        Break open the last tile to reveal three games.
      </p>
    </header>

    <p v-if="!ready && !loadError" class="dig-status">Loading tags…</p>
    <p v-if="loadError" class="dig-error">{{ loadError }}</p>

    <div v-else-if="ready" class="dig-layout">
      <div class="dig-stage">
        <canvas
          ref="canvasRef"
          class="dig-canvas"
          data-testid="dig-canvas"
          :width="viewW"
          :height="viewH"
          aria-label="Dig. Arrow keys or WASD knock away dirt and sand."
          tabindex="0"
          @click="onCanvasClick"
          @mousemove="onCanvasMove"
        />
        <div class="dig-pad" aria-label="Move">
          <button type="button" class="dig-key" aria-label="Dig up" @pointerdown.prevent="holdDir('up', true)" @pointerup="holdDir('up', false)" @pointerleave="holdDir('up', false)">↑</button>
          <button type="button" class="dig-key" aria-label="Dig left" @pointerdown.prevent="holdDir('left', true)" @pointerup="holdDir('left', false)" @pointerleave="holdDir('left', false)">←</button>
          <button type="button" class="dig-key" aria-label="Dig down" @pointerdown.prevent="holdDir('down', true)" @pointerup="holdDir('down', false)" @pointerleave="holdDir('down', false)">↓</button>
          <button type="button" class="dig-key" aria-label="Dig right" @pointerdown.prevent="holdDir('right', true)" @pointerup="holdDir('right', false)" @pointerleave="holdDir('right', false)">→</button>
        </div>
      </div>

      <section class="dig-choices" :class="{ 'is-waiting': phase === 'choice' }" aria-live="polite">
        <p class="dig-kicker">{{ stopLabel }}</p>
        <h2 v-if="active">{{ active.prompt }}</h2>
        <h2 v-else-if="phase === 'searching'">Breaking open the tile…</h2>
        <h2 v-else-if="phase === 'revealed' || phase === 'error'">The tile broke open.</h2>
        <h2 v-else>discover your next games</h2>
        <p v-if="active" class="dig-detail">{{ active.detail }}</p>
        <p v-else-if="!broken" class="dig-detail">Dig until you reach the tile, then click it.</p>
        <p v-if="status" class="dig-status">{{ status }}</p>
        <p v-if="error && phase === 'error'" class="dig-error">{{ error }}</p>

        <div v-if="phase === 'choice' && active" data-testid="dig-choices">
          <button
            v-for="(option, index) in active.options"
            :key="option.id"
            type="button"
            class="dig-option"
            data-testid="dig-choice"
            @click="choose(index)"
          >
            <span class="dig-option-label">{{ index + 1 }}. {{ option.label }}</span>
            <span class="dig-option-detail">{{ option.detail }}</span>
          </button>
        </div>

        <button
          v-if="reached && !broken"
          type="button"
          class="btn btn-primary dig-break"
          data-testid="dig-discover"
          @click="breakOpen"
        >
          Break open the tile
        </button>

        <p v-if="phase === 'play' && active" class="dig-help">
          Arrow keys or WASD knock away dirt and sand. Movement pauses at each stop. Press 1–{{ active.options.length }} or click a number.
        </p>
      </section>

      <aside class="card dig-panel">
        <div class="card-header">
          <h5>This search</h5>
        </div>
        <div class="card-body">
          <ul class="dig-query">
            <li v-if="picks.tags.length"><strong>Tags</strong> {{ picks.tags.join(' AND ') }}</li>
            <li v-if="picks.minDate && picks.maxDate"><strong>Release</strong> {{ picks.minDate }} through {{ picks.maxDate }}</li>
            <li v-if="picks.reviewScores && picks.reviewScores.length">
              <strong>Review score at least</strong> {{ picks.scoreLabel }}
              ({{ picks.reviewScores.join(', ') }})
            </li>
            <li v-if="picks.reviewCountLabel"><strong>Reviews</strong> {{ picks.reviewCountLabel }}</li>
            <li v-if="!picks.history.length" class="dig-muted">Nothing picked yet. Adult games stay out, the same way Find a Game starts.</li>
          </ul>

          <h3 v-if="picks.history.length">Stops</h3>
          <ol class="dig-history">
            <li v-for="(item, index) in picks.history" :key="index">{{ item }}</li>
          </ol>

          <div v-if="games.length" class="dig-results">
            <h3>{{ games.length >= 3 ? 'Three games from the query' : 'Games from the query' }}</h3>
            <article v-for="(game, index) in games" :key="game.appId + '-' + index" class="dig-game" data-testid="dig-game">
              <a v-if="game.url" :href="game.url" target="_blank" rel="noopener noreferrer">{{ index + 1 }}. {{ game.name }}</a>
              <p v-else>{{ index + 1 }}. {{ game.name }}</p>
              <p>{{ game.reviewScoreDesc }}</p>
              <p>Released {{ game.releaseDate }}</p>
              <p>
                {{ game.totalReviews.toLocaleString('en-US') }} reviews
                ({{ game.positive.toLocaleString('en-US') }} positive, {{ game.negative.toLocaleString('en-US') }} negative)
              </p>
              <p>App {{ game.appId }}</p>
            </article>
          </div>

          <p v-if="shortfall" class="dig-shortfall" data-testid="dig-shortfall">
            <template v-if="shortfall.pending">
              This search returned {{ shortfall.count }} {{ shortfall.count === 1 ? 'game' : 'games' }}, fewer than 3.
              Finding which constraint emptied the list…
            </template>
            <template v-else>
              This search returned {{ shortfall.count }} {{ shortfall.count === 1 ? 'game' : 'games' }}, fewer than 3.
              The constraint that emptied the list: <strong>{{ shortfall.constraint }}</strong>.
            </template>
          </p>

          <button type="button" class="btn btn-secondary dig-restart" @click="restart">Start over</button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { drawFrame } from '../game/digRender.js'
import {
  appendDiscover,
  appendEncounter,
  appendGround,
  cameraTop,
  choiceIndexAt,
  isDiscoverTile,
  makeWorld,
  resolveChoice,
  TILE_SIZE,
  tryMove,
  updateParticles,
  VIEW_H,
  VIEW_W
} from '../game/digWorld.js'
import {
  fetchEarliestReleaseDate,
  loadTagGroups,
  mapDigGames,
  nameEmptiedConstraint,
  runDigSearch,
  warmAdultExclusion
} from '../game/digQuery.js'
import { formatDay, todayYmd } from '../game/digDates.js'
import {
  applyEffect,
  dateSplitEncounter,
  freshPicks,
  recencyEncounter,
  resetPicks,
  reviewsEncounter,
  scoreEncounter,
  tagEncounter
} from '../game/digRules.js'

const viewW = VIEW_W
const viewH = VIEW_H
const isHighContrast = inject('isHighContrast', null)

const canvasRef = ref(null)
const ready = ref(false)
const loadError = ref('')
const phase = ref('play')
const active = ref(null)
const completed = ref(0)
const reached = ref(false)
const broken = ref(false)
const games = ref([])
const shortfall = ref(null)
const error = ref('')
const status = ref('')
const earliest = ref('')
const picks = reactive(freshPicks())

const totalStops = computed(() => (picks.skipDateSplit ? 9 : 10))
const stopLabel = computed(() => {
  if (!active.value) return broken.value ? 'Tile open' : 'Last tile'
  return `Stop ${completed.value + 1} of ${totalStops.value}`
})

let world = null
let script = []
let stepIndex = 0
let raf = 0
let lastFrame = 0
let nextMoveAt = 0
let searchGen = 0
let gameHits = []
let earliestPromise = null
const held = new Set()
let lastDir = null

const DIRS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  W: 'up',
  A: 'left',
  S: 'down',
  D: 'right'
}

function contrastOn() {
  if (!isHighContrast) return false
  return typeof isHighContrast === 'object' ? !!isHighContrast.value : !!isHighContrast
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildScript(groups) {
  return [
    ...groups.map((group, index) => tagEncounter(group, index)),
    { kind: 'recency' },
    { kind: 'datesplit' },
    { kind: 'score' },
    { kind: 'reviews' }
  ]
}

function materialize(step) {
  if (step.kind === 'tags') return step
  if (step.kind === 'recency') return recencyEncounter(todayYmd(), earliest.value || '')
  if (step.kind === 'datesplit') return dateSplitEncounter(picks.coarseMin, picks.coarseMax)
  if (step.kind === 'score') return scoreEncounter()
  if (step.kind === 'reviews') return reviewsEncounter()
  return step
}

function showEncounter(step) {
  let encounter
  try {
    encounter = materialize(step)
  } catch (err) {
    error.value = err.message || 'Could not build the next stop.'
    phase.value = 'error'
    return
  }
  appendGround(world, 4)
  appendEncounter(world, encounter.options.length)
  active.value = encounter
  phase.value = 'play'
}

function startLevel() {
  world = makeWorld()
  stepIndex = 0
  completed.value = 0
  reached.value = false
  broken.value = false
  games.value = []
  shortfall.value = null
  error.value = ''
  status.value = ''
  showEncounter(script[0])
}

function advance() {
  completed.value += 1
  stepIndex += 1
  while (stepIndex < script.length) {
    const step = script[stepIndex]
    if (step.kind === 'datesplit' && picks.skipDateSplit) {
      stepIndex += 1
      continue
    }
    showEncounter(step)
    return
  }
  appendGround(world, 3)
  appendDiscover(world)
  active.value = null
  phase.value = 'play'
}

function ensureEarliest() {
  if (!earliestPromise) {
    earliestPromise = fetchEarliestReleaseDate()
      .then((date) => {
        if (date) earliest.value = date
        return date || ''
      })
      .catch(() => '')
  }
  return earliestPromise
}

async function choose(index) {
  if (phase.value !== 'choice' || !active.value) return
  const option = active.value.options[index]
  if (!option) return
  phase.value = 'resolving'
  if (world.choice) world.choice.selected = index
  let effect = { ...option.effect }
  if (effect.type === 'recency' && effect.id === 'before-2020' && !effect.minDate) {
    status.value = 'Reading the earliest release date…'
    try {
      const date = await ensureEarliest()
      if (!date) throw new Error('Could not read the earliest release date.')
      const detail = `${formatDay(date)} – ${formatDay('2019-12-31')}`
      effect = {
        ...effect,
        minDate: date,
        maxDate: '2019-12-31',
        label: detail,
        historyLabel: `Before 2020 (${detail})`
      }
    } catch (err) {
      error.value = err.message || 'Could not read the earliest release date.'
      status.value = ''
      phase.value = 'choice'
      return
    }
    status.value = ''
  }
  await wait(160)
  if (phase.value !== 'resolving') return
  applyEffect(picks, effect)
  resolveChoice(world)
  advance()
}

async function breakOpen() {
  if (!world?.reachedDiscover || world.broken || phase.value === 'searching') return
  world.broken = true
  world.brokenAt = performance.now()
  broken.value = true
  phase.value = 'searching'
  status.value = 'Searching Find a Game…'
  const gen = ++searchGen
  try {
    const rows = await runDigSearch(picks)
    if (gen !== searchGen) return
    games.value = mapDigGames(rows)
    status.value = ''
    if (games.value.length < 3) {
      shortfall.value = { count: games.value.length, constraint: '', pending: true }
      phase.value = 'revealed'
      try {
        const name = await nameEmptiedConstraint(picks, games.value.length)
        if (gen !== searchGen) return
        shortfall.value = { count: games.value.length, constraint: name, pending: false }
      } catch (err) {
        if (gen !== searchGen) return
        shortfall.value = {
          count: games.value.length,
          constraint: err.message || 'the search failed while checking constraints',
          pending: false
        }
      }
    } else {
      shortfall.value = null
      phase.value = 'revealed'
    }
  } catch (err) {
    if (gen !== searchGen) return
    status.value = ''
    error.value = err.message || 'The Find a Game search failed.'
    phase.value = 'error'
  }
}

function restart() {
  searchGen += 1
  held.clear()
  lastDir = null
  resetPicks(picks)
  startLevel()
}

function currentDir() {
  if (lastDir && held.has(lastDir)) return lastDir
  return ['down', 'left', 'right', 'up'].find((dir) => held.has(dir)) || null
}

function holdDir(dir, down) {
  if (down) {
    held.add(dir)
    lastDir = dir
  } else if (held.has(dir)) {
    held.delete(dir)
  }
}

function pointer(event) {
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const localX = ((event.clientX - rect.left) * VIEW_W) / rect.width
  const localY = ((event.clientY - rect.top) * VIEW_H) / rect.height
  const cam = cameraTop(world)
  return {
    localX,
    localY,
    x: Math.floor(localX / TILE_SIZE),
    y: Math.floor(localY / TILE_SIZE) + cam
  }
}

function onCanvasClick(event) {
  if (!world) return
  const point = pointer(event)
  const hit = gameHits.find((entry) => (
    point.localX >= entry.x &&
    point.localX <= entry.x + entry.w &&
    point.localY >= entry.y &&
    point.localY <= entry.y + entry.h
  ))
  if (hit?.url) {
    window.open(hit.url, '_blank', 'noopener')
    return
  }
  if (phase.value === 'choice') {
    const index = choiceIndexAt(world, point.x, point.y)
    if (index >= 0) choose(index)
    return
  }
  if (isDiscoverTile(world, point.x, point.y)) breakOpen()
}

function onCanvasMove(event) {
  if (!world || !canvasRef.value) return
  const point = pointer(event)
  const overChoice = phase.value === 'choice' && choiceIndexAt(world, point.x, point.y) >= 0
  const overDiscover = isDiscoverTile(world, point.x, point.y) && world.reachedDiscover && !world.broken
  const overGame = gameHits.some((entry) => (
    point.localX >= entry.x &&
    point.localX <= entry.x + entry.w &&
    point.localY >= entry.y &&
    point.localY <= entry.y + entry.h &&
    entry.url
  ))
  canvasRef.value.style.cursor = overChoice || overDiscover || overGame ? 'pointer' : 'default'
}

function onKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const dir = DIRS[event.key]
  if (dir) {
    held.add(dir)
    lastDir = dir
    event.preventDefault()
    return
  }
  if (phase.value === 'choice' && /^[1-9]$/.test(event.key) && active.value) {
    const index = Number(event.key) - 1
    if (index < active.value.options.length) {
      event.preventDefault()
      choose(index)
    }
  }
}

function onKeyUp(event) {
  const dir = DIRS[event.key]
  if (dir) held.delete(dir)
}

function loop(now) {
  const dt = Math.min(40, now - lastFrame || 16)
  lastFrame = now
  if (world && phase.value === 'play' && now >= nextMoveAt) {
    const dir = currentDir()
    if (dir) {
      const result = tryMove(world, dir)
      nextMoveAt = now + (result.dug ? 125 : 85)
      if (result.paused) phase.value = 'choice'
    }
  }
  if (world) {
    updateParticles(world, dt)
    reached.value = !!world.reachedDiscover
    const ctx = canvasRef.value?.getContext('2d')
    if (ctx) {
      try {
        const drawn = drawFrame(ctx, {
          world,
          time: now,
          highContrast: contrastOn(),
          games: games.value,
          shortfall: shortfall.value,
          error: phase.value === 'error' ? error.value : '',
          phase: phase.value
        })
        gameHits = drawn.gameHits || []
      } catch (err) {
        if (!error.value) error.value = err.message
      }
    }
  }
  raf = requestAnimationFrame(loop)
}

watch(earliest, (date) => {
  if (!date || active.value?.kind !== 'recency' || phase.value === 'resolving') return
  active.value = recencyEncounter(todayYmd(), date)
})

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  try {
    const groups = await loadTagGroups()
    script = buildScript(groups)
    startLevel()
    ready.value = true
    await nextTick()
    ensureEarliest()
    warmAdultExclusion()
    lastFrame = performance.now()
    raf = requestAnimationFrame(loop)
  } catch (err) {
    loadError.value = err.message || 'Could not load tags.'
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  searchGen += 1
})
</script>

<style scoped>
.dig-intro {
  margin-bottom: 1rem;
  max-width: 46rem;
}

.dig-intro h1 {
  margin-bottom: 0.35rem;
}

.dig-intro p,
.dig-detail,
.dig-help,
.dig-muted {
  color: var(--color-text-muted);
  margin-bottom: 0.75rem;
}

.dig-layout {
  display: grid;
  grid-template-columns: minmax(280px, 440px) minmax(240px, 1fr);
  grid-template-areas:
    "stage panel"
    "choices panel";
  gap: 1rem 1.25rem;
  align-items: start;
}

.dig-stage { grid-area: stage; }
.dig-choices { grid-area: choices; }
.dig-panel { grid-area: panel; margin-bottom: 0; }

.dig-canvas {
  width: 100%;
  height: auto;
  display: block;
  background: #1a120c;
  border-radius: 12px;
  border: 1px solid rgba(212, 175, 55, 0.45);
  touch-action: none;
}

.dig-pad {
  display: grid;
  grid-template-columns: repeat(4, 48px);
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.dig-key {
  height: 42px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-alt);
  color: var(--color-text);
  font-size: 1.1rem;
}

.dig-kicker {
  color: var(--color-accent);
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.dig-choices h2,
.dig-panel h3 {
  font-size: 1.25rem;
  margin: 0 0 0.35rem;
}

.dig-choices.is-waiting {
  padding: 0.85rem 1rem;
  border: 1px solid rgba(212, 175, 55, 0.55);
  border-radius: var(--radius);
  background: rgba(212, 175, 55, 0.08);
}

.dig-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  margin-bottom: 0.5rem;
  padding: 0.65rem 0.8rem;
  border-radius: var(--radius);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
}

.dig-option:hover,
.dig-option:focus-visible {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.dig-option-label {
  font-weight: 600;
}

.dig-option-detail {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.dig-break,
.dig-restart {
  margin-top: 0.5rem;
}

.dig-query,
.dig-history {
  padding-left: 1.1rem;
  margin-bottom: 1rem;
}

.dig-query li,
.dig-history li,
.dig-game p {
  margin-bottom: 0.35rem;
}

.dig-game {
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: var(--radius);
  padding: 0.75rem 0.9rem;
  margin-bottom: 0.6rem;
  background: var(--color-bg);
}

.dig-game a {
  font-weight: 700;
  color: var(--color-accent);
}

.dig-shortfall {
  border-left: 3px solid var(--color-accent);
  padding-left: 0.75rem;
  margin: 0.5rem 0 1rem;
}

.dig-error {
  color: var(--color-error);
}

.dig-status {
  color: var(--color-accent);
}

@media (max-width: 1099px) {
  .dig-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "stage"
      "choices"
      "panel";
  }
}
</style>
