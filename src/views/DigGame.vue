<template>
  <div class="dig-page">
    <header class="dig-intro">
      <h1>DIIIG</h1>
      <p>
        Knock away the metal and stone. Dig into a named block to add that choice to a Find a Game search.
        The search starts as soon as the last choice is in. Tap the last box five times to crack it open.
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
          aria-label="DIIIG. Arrow keys or WASD knock away the ground."
          tabindex="0"
          @click="onCanvasClick"
          @mousemove="onCanvasMove"
        />
        <div class="dig-pad" aria-label="Move">
          <button type="button" class="dig-key" aria-label="Dig left" @pointerdown.prevent="holdDir('left', true)" @pointerup="holdDir('left', false)" @pointerleave="holdDir('left', false)">←</button>
          <button type="button" class="dig-key dig-key-down" aria-label="Dig down" @pointerdown.prevent="holdDir('down', true)" @pointerup="holdDir('down', false)" @pointerleave="holdDir('down', false)">↓</button>
          <button type="button" class="dig-key" aria-label="Dig right" @pointerdown.prevent="holdDir('right', true)" @pointerup="holdDir('right', false)" @pointerleave="holdDir('right', false)">→</button>
        </div>
      </div>

      <section class="dig-choices" :class="{ 'is-waiting': phase === 'choice' }" aria-live="polite">
        <p class="dig-kicker">{{ stopLabel }}</p>
        <h2 v-if="active">{{ active.prompt }}</h2>
        <h2 v-else-if="phase === 'searching'">Cracking the box…</h2>
        <h2 v-else-if="phase === 'revealed' || phase === 'error'">The box cracked open.</h2>
        <h2 v-else>discover your next games</h2>
        <p v-if="active" class="dig-detail">{{ active.detail }}</p>
        <p v-else-if="!broken" class="dig-detail">Dig down to the box, then tap it five times.</p>
        <p v-if="status" class="dig-status">{{ status }}</p>
        <p v-if="error && phase === 'error'" class="dig-error">{{ error }}</p>

        <div v-if="active && phase !== 'searching'" data-testid="dig-choices">
          <button
            v-for="(option, index) in active.options"
            :key="option.id"
            type="button"
            class="dig-option"
            data-testid="dig-choice"
            :disabled="phase === 'resolving'"
            @click="choose(index)"
          >
            <span class="dig-option-label">{{ index + 1 }}. {{ option.label }}</span>
            <span class="dig-option-detail">{{ option.detail }}</span>
          </button>
        </div>

        <button
          v-if="!active && !broken"
          type="button"
          class="btn btn-primary dig-break"
          data-testid="dig-discover"
          @click="tapBox"
        >
          Tap the box ({{ cracks }} / 5)
        </button>

        <p v-if="phase === 'play' && active" class="dig-help">
          Dig left or right, then dig down into a named block. Press 1–{{ active.options.length }} to pick one.
        </p>
      </section>

      <aside class="dig-panel">
        <button
          v-if="games.length"
          type="button"
          class="dig-share"
          data-testid="dig-share"
          @click="shareResults"
        >
          Share
        </button>
        <p v-if="shareNote" class="dig-muted">{{ shareNote }}</p>
        <button type="button" class="btn btn-secondary dig-restart" @click="restart">Start over</button>
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
  tapDiscover,
  TILE_SIZE,
  tryMove,
  updateParticles,
  VIEW_H,
  VIEW_W
} from '../game/digWorld.js'
import {
  fetchEarliestReleaseDate,
  dealTagGroups,
  loadTagPool,
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
const cracks = ref(0)
const searchState = ref('idle')
const games = ref([])
const shortfall = ref(null)
const error = ref('')
const status = ref('')
const shareNote = ref('')
const earliest = ref('')
const picks = reactive(freshPicks())

const totalStops = computed(() => (picks.skipDateSplit ? 7 : 8))
const stopLabel = computed(() => {
  if (!active.value) return broken.value ? 'Box open' : 'Last box'
  return `Stop ${completed.value + 1} of ${totalStops.value}`
})

let world = null
let tagPool = []
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
  appendEncounter(world, encounter.options)
  active.value = encounter
  phase.value = 'play'
}

function startLevel() {
  script = buildScript(dealTagGroups(tagPool))
  world = makeWorld()
  stepIndex = 0
  completed.value = 0
  reached.value = false
  broken.value = false
  cracks.value = 0
  searchState.value = 'idle'
  games.value = []
  shortfall.value = null
  error.value = ''
  status.value = ''
  shareNote.value = ''
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
  beginSearch()
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
  if (!active.value || (phase.value !== 'choice' && phase.value !== 'play')) return
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
      if (world?.choice) world.choice.pending = false
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

function applySearchRows(rows, gen) {
  if (gen !== searchGen) return
  games.value = mapDigGames(rows)
  searchState.value = 'ready'
  if (games.value.length < 3) {
    shortfall.value = { count: games.value.length, constraint: '', pending: true }
    if (world?.broken) {
      phase.value = 'revealed'
      status.value = ''
    } else {
      status.value = 'Search ready. Tap the box five times.'
    }
    nameEmptiedConstraint(picks, games.value.length)
      .then((name) => {
        if (gen !== searchGen) return
        shortfall.value = { count: games.value.length, constraint: name, pending: false }
      })
      .catch((err) => {
        if (gen !== searchGen) return
        shortfall.value = {
          count: games.value.length,
          constraint: err.message || 'the search failed while checking constraints',
          pending: false
        }
      })
    return
  }
  shortfall.value = null
  if (world?.broken) {
    phase.value = 'revealed'
    status.value = ''
  } else {
    status.value = 'Search ready. Tap the box five times.'
  }
}

function beginSearch() {
  if (searchState.value === 'loading' || searchState.value === 'ready') return
  searchState.value = 'loading'
  status.value = 'Searching…'
  const gen = ++searchGen
  runDigSearch(picks)
    .then((rows) => applySearchRows(rows, gen))
    .catch((err) => {
      if (gen !== searchGen) return
      searchState.value = 'error'
      error.value = err.message || 'The Find a Game search failed.'
      status.value = ''
      if (world?.broken) phase.value = 'error'
      else status.value = error.value
    })
}

function revealIfOpen() {
  if (!world?.broken) return
  broken.value = true
  cracks.value = world.cracks || 0
  if (searchState.value === 'error') {
    phase.value = 'error'
    return
  }
  if (searchState.value === 'ready') {
    phase.value = 'revealed'
    status.value = ''
    return
  }
  phase.value = 'searching'
  status.value = 'Cracked. Still searching…'
}

function tapBox() {
  if (!world?.discover || world.broken) return
  if (phase.value === 'resolving' || phase.value === 'searching') return
  tapDiscover(world)
  cracks.value = world.cracks || 0
  world.reachedDiscover = true
  reached.value = true
  if (world.broken) revealIfOpen()
}

async function shareResults() {
  const origin = window.location.origin
  const lines = ['DIIIG found these games:']
  games.value.forEach((game, index) => {
    lines.push(`${index + 1}. ${game.name}`)
    if (game.url) lines.push(game.url)
  })
  lines.push('')
  lines.push(`Try DIIIG yourself: ${origin}/diiig`)
  const text = lines.join('\n')
  try {
    await navigator.clipboard.writeText(text)
    shareNote.value = 'Copied the list, the Steam links, and a link to DIIIG.'
  } catch {
    shareNote.value = 'Clipboard is blocked in this browser. The list is still on this page.'
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
    if (world) world.discoverHeld = false
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
  if (phase.value === 'play' || phase.value === 'choice') {
    const index = choiceIndexAt(world, point.x, point.y)
    if (index >= 0) {
      choose(index)
      return
    }
  }
  if (isDiscoverTile(world, point.x, point.y) && !world.broken) tapBox()
}

function onCanvasMove(event) {
  if (!world || !canvasRef.value) return
  const point = pointer(event)
  const overChoice = (phase.value === 'play' || phase.value === 'choice') && choiceIndexAt(world, point.x, point.y) >= 0
  const overDiscover = isDiscoverTile(world, point.x, point.y) && !world.broken
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
  if ((phase.value === 'choice' || phase.value === 'play') && /^[1-9]$/.test(event.key) && active.value) {
    const index = Number(event.key) - 1
    if (index < active.value.options.length) {
      event.preventDefault()
      choose(index)
    }
  }
}

function onKeyUp(event) {
  const dir = DIRS[event.key]
  if (!dir) return
  held.delete(dir)
  if (world) world.discoverHeld = false
}

function loop(now) {
  const dt = Math.min(40, now - lastFrame || 16)
  lastFrame = now
  if (world && phase.value === 'play' && now >= nextMoveAt) {
    const dir = currentDir()
    if (dir) {
      const result = tryMove(world, dir)
      nextMoveAt = now + (result.dug ? 125 : 85)
      if (result.chose != null) choose(result.chose)
      if (result.discover) revealIfOpen()
    }
  }
  if (world) {
    updateParticles(world, dt)
    reached.value = !!world.reachedDiscover
    cracks.value = world.cracks || 0
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
          phase: phase.value,
          loading: searchState.value === 'loading'
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
  if (world?.choice && !world.choice.resolved) {
    active.value.options.forEach((option, index) => {
      const slot = world.choice.slots.find((entry) => entry.optionIndex === index)
      if (slot) slot.label = option.label
    })
  }
})

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  try {
    tagPool = await loadTagPool()
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
  grid-template-columns: minmax(320px, 720px) minmax(240px, 1fr);
  grid-template-areas:
    "stage panel"
    "choices panel";
  gap: 1rem 1.25rem;
  align-items: start;
}

.dig-stage { grid-area: stage; }
.dig-choices { grid-area: choices; }
.dig-panel { grid-area: panel; margin-bottom: 0; }

.dig-page {
  --dig-steel: #8ea0b0;
  --dig-blue: #7eb6d6;
  --dig-ink: #d5e2ea;
}

.dig-canvas {
  width: 100%;
  height: auto;
  display: block;
  background: #1b242c;
  border-radius: 12px;
  border: 1px solid rgba(126, 182, 214, 0.45);
  touch-action: none;
}

.dig-pad {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 0.5rem;
  width: 100%;
  margin: 0.75rem auto 0;
}

.dig-key {
  height: 42px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-alt);
  color: var(--color-text);
  font-size: 1.1rem;
}

.dig-kicker,
.dig-status {
  color: var(--dig-blue);
}

.dig-kicker {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.dig-choices h2 {
  font-size: 1.25rem;
  margin: 0 0 0.35rem;
}

.dig-choices.is-waiting {
  padding: 0.85rem 1rem;
  border: 1px solid rgba(126, 182, 214, 0.55);
  border-radius: var(--radius);
  background: rgba(126, 182, 214, 0.08);
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
  border-color: var(--dig-blue);
  background: rgba(126, 182, 214, 0.12);
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

.dig-share {
  display: block;
  width: 100%;
  margin: 0 0 0.85rem;
  padding: 0.95rem 1.15rem;
  border: none;
  border-radius: 12px;
  background: #3ec6ff;
  color: #041018;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  box-shadow: 0 0 0 1px rgba(190, 240, 255, 0.7), 0 10px 28px rgba(62, 198, 255, 0.4);
}

.dig-share:hover,
.dig-share:focus-visible {
  background: #74dcff;
  color: #041018;
}

.dig-restart {
  width: 100%;
}

.dig-page .btn-primary {
  background: #4f6f88;
  border-color: #9bb4c6;
  color: #f2f6f8;
}

.dig-page .btn-primary:hover,
.dig-page .btn-primary:focus-visible {
  background: #3f5c72;
  border-color: #c5d4e0;
  color: #f2f6f8;
}

.dig-error {
  color: var(--color-error);
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
