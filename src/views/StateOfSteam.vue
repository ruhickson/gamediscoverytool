<template>
  <div class="state-of-steam">
    <div class="card">
      <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <h5 class="mb-0"><i class="fas fa-chart-area"></i> State of Steam</h5>
        <div class="d-flex flex-wrap align-items-center gap-2">
          <label class="time-machine-label mb-0" for="timeMachine">
            <i class="fas fa-clock"></i> Time Machine
          </label>
          <select
            id="timeMachine"
            class="form-select form-select-sm time-machine-select"
            v-model="selectedMonth"
            :disabled="isLoading"
            @change="loadMetrics"
          >
            <option
              v-for="opt in timeMachineOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <button
            class="btn btn-outline-light btn-sm"
            type="button"
            :disabled="isLoading"
            @click="loadMetrics"
            title="Refresh metrics"
          >
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
            Refresh
          </button>
        </div>
      </div>
      <div class="card-body">
        <div v-if="error" class="error">{{ error }}</div>

        <div v-if="isLoading && !metrics" class="loading">
          Loading Steam metrics for {{ periodLabel }}…
        </div>

        <template v-if="metrics">
          <p class="period-banner text-muted">
            Showing metrics for <strong>{{ metrics.period.label }}</strong>
            <span v-if="metrics.period.isCurrent"> (through today)</span>
            <span v-if="metrics.source === 'snapshot'" class="source-pill">snapshot</span>
            <span v-else-if="metrics.source === 'live'" class="source-pill">live</span>
          </p>

          <div class="metric-grid mb-4">
            <div class="metric-card" v-for="card in bigNumberCards" :key="card.label">
              <div class="metric-label">{{ card.label }}</div>
              <div class="metric-value">
                <span v-if="card.pending" class="metric-pending">…</span>
                <span v-else>{{ formatNumber(card.value) }}</span>
              </div>
            </div>
          </div>
          <p v-if="historicalError" class="historical-note text-muted">{{ historicalError }}</p>

          <div class="metric-grid mb-4">
            <div class="metric-card" v-for="card in reviewStatCards" :key="card.label">
              <div class="metric-label">{{ card.label }}</div>
              <div class="metric-value">{{ card.display }}</div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div :class="metrics.period.isCurrent ? 'col-lg-6' : 'col-12'">
              <div
                class="chart-panel"
                data-drill-root="released"
                @pointerdown.stop
              >
                <h6 class="chart-title">Games released — {{ metrics.period.label }}</h6>
                <p class="chart-subtitle text-muted">
                  Daily count · total {{ formatNumber(releasedMonthTotal) }}
                  <span v-if="drill?.chart !== 'released'"> · click a bar for games</span>
                </p>
                <div v-if="drill?.chart === 'released'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                  </div>
                  <div v-if="drill.loading" class="drilldown-status">Loading games…</div>
                  <div v-else-if="drill.error" class="drilldown-status error">{{ drill.error }}</div>
                  <ul v-else class="drilldown-list">
                    <li v-for="game in drill.games" :key="game.appId" class="drilldown-item">
                      <div class="drilldown-game-name">{{ game.name }}</div>
                      <div class="drilldown-meta">
                        <span v-if="game.reviewScoreDesc" class="text-muted">{{ game.reviewScoreDesc }}</span>
                        <span v-if="game.totalReviews" class="text-muted">{{ formatNumber(game.totalReviews) }} reviews</span>
                      </div>
                      <div class="drilldown-links">
                        <a
                          :href="`https://store.steampowered.com/app/${game.appId}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >Steam</a>
                        <a
                          :href="getItadUrl(game.name)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >ITAD</a>
                      </div>
                    </li>
                    <li v-if="!drill.games.length" class="drilldown-status text-muted">No games for this day.</li>
                  </ul>
                </div>
                <div v-else class="chart-wrap chart-wrap-clickable">
                  <canvas ref="releasedChartEl"></canvas>
                </div>
              </div>
            </div>
            <div v-if="metrics.period.isCurrent" class="col-lg-6">
              <div class="chart-panel">
                <h6 class="chart-title">Games due for release — next 7 days</h6>
                <p class="chart-subtitle text-muted">
                  Daily count · total {{ formatNumber(dueNext7Total) }}
                </p>
                <div class="chart-wrap">
                  <canvas ref="upcomingChartEl"></canvas>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-lg-6">
              <div
                class="chart-panel"
                data-drill-root="genres"
                @pointerdown.stop
              >
                <h6 class="chart-title">Genres released — {{ metrics.period.label }}</h6>
                <p class="chart-subtitle text-muted">
                  Games released that month by genre
                  <span v-if="drill?.chart !== 'genres'"> · click a bar for games</span>
                </p>
                <div v-if="drill?.chart === 'genres'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                  </div>
                  <div v-if="drill.loading" class="drilldown-status">Loading games…</div>
                  <div v-else-if="drill.error" class="drilldown-status error">{{ drill.error }}</div>
                  <ul v-else class="drilldown-list">
                    <li v-for="game in drill.games" :key="game.appId" class="drilldown-item">
                      <div class="drilldown-game-name">{{ game.name }}</div>
                      <div class="drilldown-meta">
                        <span v-if="game.releaseDate" class="text-muted">{{ game.releaseDate }}</span>
                        <span v-if="game.reviewScoreDesc" class="text-muted">{{ game.reviewScoreDesc }}</span>
                      </div>
                      <div class="drilldown-links">
                        <a
                          :href="`https://store.steampowered.com/app/${game.appId}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >Steam</a>
                        <a
                          :href="getItadUrl(game.name)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >ITAD</a>
                      </div>
                    </li>
                    <li v-if="!drill.games.length" class="drilldown-status text-muted">No games for this genre.</li>
                  </ul>
                </div>
                <div
                  v-else
                  class="chart-wrap chart-wrap-genres chart-wrap-clickable"
                  :style="{ '--genre-count': metrics.genresInMonth?.length || 8 }"
                >
                  <canvas ref="genresChartEl"></canvas>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div
                class="chart-panel"
                data-drill-root="tags"
                @pointerdown.stop
              >
                <h6 class="chart-title">Popular tags — {{ metrics.period.label }}</h6>
                <p class="chart-subtitle text-muted">
                  Top tags on games released that month
                  <span v-if="drill?.chart !== 'tags'"> · click a bar for games</span>
                </p>
                <div v-if="drill?.chart === 'tags'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                  </div>
                  <div v-if="drill.loading" class="drilldown-status">Loading games…</div>
                  <div v-else-if="drill.error" class="drilldown-status error">{{ drill.error }}</div>
                  <ul v-else class="drilldown-list">
                    <li v-for="game in drill.games" :key="game.appId" class="drilldown-item">
                      <div class="drilldown-game-name">{{ game.name }}</div>
                      <div class="drilldown-meta">
                        <span v-if="game.releaseDate" class="text-muted">{{ game.releaseDate }}</span>
                        <span v-if="game.reviewScoreDesc" class="text-muted">{{ game.reviewScoreDesc }}</span>
                      </div>
                      <div class="drilldown-links">
                        <a
                          :href="`https://store.steampowered.com/app/${game.appId}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >Steam</a>
                        <a
                          :href="getItadUrl(game.name)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >ITAD</a>
                      </div>
                    </li>
                    <li v-if="!drill.games.length" class="drilldown-status text-muted">No games for this tag.</li>
                  </ul>
                </div>
                <div
                  v-else
                  class="chart-wrap chart-wrap-genres chart-wrap-clickable"
                  :style="{ '--genre-count': metrics.tagsInMonth?.length || 8 }"
                >
                  <canvas ref="tagsChartEl"></canvas>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-lg-4">
              <div
                class="chart-panel"
                data-drill-root="freePaid"
                @pointerdown.stop
              >
                <h6 class="chart-title">Free vs paid</h6>
                <p class="chart-subtitle text-muted">
                  {{ metrics.period.label }}
                  <span v-if="drill?.chart !== 'freePaid'"> · click a slice for games</span>
                </p>
                <div v-if="drill?.chart === 'freePaid'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                  </div>
                  <div v-if="drill.loading" class="drilldown-status">Loading games…</div>
                  <div v-else-if="drill.error" class="drilldown-status error">{{ drill.error }}</div>
                  <ul v-else class="drilldown-list">
                    <li v-for="game in drill.games" :key="game.appId" class="drilldown-item">
                      <div class="drilldown-game-name">{{ game.name }}</div>
                      <div class="drilldown-meta">
                        <span v-if="game.releaseDate" class="text-muted">{{ game.releaseDate }}</span>
                        <span v-if="game.reviewScoreDesc" class="text-muted">{{ game.reviewScoreDesc }}</span>
                      </div>
                      <div class="drilldown-links">
                        <a
                          :href="`https://store.steampowered.com/app/${game.appId}`"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >Steam</a>
                        <a
                          :href="getItadUrl(game.name)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="game-link"
                        >ITAD</a>
                      </div>
                    </li>
                    <li v-if="!drill.games.length" class="drilldown-status text-muted">No games in this category.</li>
                  </ul>
                </div>
                <div v-else class="chart-wrap chart-wrap-doughnut chart-wrap-clickable">
                  <canvas ref="freePaidChartEl"></canvas>
                </div>
              </div>
            </div>
            <div class="col-lg-4">
              <div class="chart-panel">
                <h6 class="chart-title">Review score mix</h6>
                <p class="chart-subtitle text-muted">Games by Steam review band</p>
                <div
                  class="chart-wrap chart-wrap-genres"
                  :style="{ '--genre-count': metrics.reviewScoreMix?.length || 8 }"
                >
                  <canvas ref="scoreMixChartEl"></canvas>
                </div>
              </div>
            </div>
            <div class="col-lg-4">
              <div class="chart-panel">
                <h6 class="chart-title">Positive vs negative reviews</h6>
                <p class="chart-subtitle text-muted">
                  Review volume for games released in {{ metrics.period.label }}
                </p>
                <div class="chart-wrap chart-wrap-doughnut">
                  <canvas ref="sentimentChartEl"></canvas>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-lg-4" v-for="board in sentimentBoards" :key="board.title">
              <div class="chart-panel">
                <h6 class="chart-title">{{ board.title }}</h6>
                <p class="chart-subtitle text-muted">{{ board.subtitle }}</p>
                <div class="table-responsive leaderboard">
                  <table class="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Game</th>
                        <th>{{ board.metricHeader }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(game, idx) in board.rows" :key="game.appId || idx">
                        <td>{{ idx + 1 }}</td>
                        <td>
                          <a
                            class="game-link"
                            :href="`https://store.steampowered.com/app/${game.appId}`"
                            target="_blank"
                            rel="noopener noreferrer"
                          >{{ game.name }}</a>
                        </td>
                        <td>{{ board.format(game) }}</td>
                      </tr>
                      <tr v-if="!board.rows?.length">
                        <td colspan="3" class="text-muted">No games met the review threshold.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div class="row g-3">
            <div class="col-lg-6" v-for="board in studioBoards" :key="board.title">
              <div class="chart-panel">
                <h6 class="chart-title">{{ board.title }}</h6>
                <p class="chart-subtitle text-muted">{{ board.subtitle }}</p>
                <div class="table-responsive leaderboard">
                  <table class="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{{ board.nameHeader }}</th>
                        <th>Games</th>
                        <th>{{ board.metricHeader }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(studio, idx) in board.rows" :key="studio.name + idx">
                        <td>{{ idx + 1 }}</td>
                        <td>{{ studio.name }}</td>
                        <td>{{ formatNumber(studio.games) }}</td>
                        <td>{{ board.format(studio) }}</td>
                      </tr>
                      <tr v-if="!board.rows?.length">
                        <td colspan="4" class="text-muted">No studios found for this period.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement
} from 'chart.js'
import cubeService from '../services/cubeService'
import { getItadUrl } from '../services/itadService'
import { getTimeMachineOptions } from '../utils/timeMachine'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  DoughnutController,
  ArcElement
)

const GOLD = '#d4af37'
const GOLD_SOFT = 'rgba(212, 175, 55, 0.75)'
const MUTED = '#94a3b8'
const GRID = 'rgba(148, 163, 184, 0.18)'
const SLATE = '#64748b'
const POSITIVE_GREEN = '#6ee7b7'
const NEGATIVE_RED = '#fca5a5'

/** Soft multi-hue palette for genre/tag bars (dark theme friendly) */
const CATEGORY_PALETTE = [
  { fill: 'rgba(212, 175, 55, 0.78)', stroke: '#d4af37' },
  { fill: 'rgba(110, 231, 183, 0.78)', stroke: '#6ee7b7' },
  { fill: 'rgba(125, 211, 252, 0.78)', stroke: '#7dd3fc' },
  { fill: 'rgba(253, 164, 175, 0.78)', stroke: '#fda4af' },
  { fill: 'rgba(253, 186, 116, 0.78)', stroke: '#fdba74' },
  { fill: 'rgba(163, 230, 53, 0.78)', stroke: '#a3e635' },
  { fill: 'rgba(103, 232, 249, 0.78)', stroke: '#67e8f9' },
  { fill: 'rgba(249, 168, 212, 0.78)', stroke: '#f9a8d4' },
  { fill: 'rgba(147, 197, 253, 0.78)', stroke: '#93c5fd' },
  { fill: 'rgba(252, 211, 77, 0.78)', stroke: '#fcd34d' },
  { fill: 'rgba(134, 239, 172, 0.78)', stroke: '#86efac' },
  { fill: 'rgba(165, 180, 252, 0.78)', stroke: '#a5b4fc' }
]

function categoryColors(count) {
  return Array.from({ length: count }, (_, i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length])
}

function formatDayLabel(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  })
}

function tooltipDefaults() {
  return {
    backgroundColor: '#1e293b',
    titleColor: GOLD,
    bodyColor: '#e8eef7',
    borderColor: 'rgba(212, 175, 55, 0.45)',
    borderWidth: 1
  }
}

function buildDayBarChart(canvas, series, label, onSelect) {
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: series.map((row) => formatDayLabel(row.date)),
      datasets: [{
        label,
        data: series.map((row) => row.count),
        backgroundColor: GOLD_SOFT,
        borderColor: GOLD,
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 36
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event, elements) => {
        if (!onSelect || !elements.length) return
        const idx = elements[0].index
        const row = series[idx]
        if (row) onSelect(row, idx)
      },
      plugins: { legend: { display: false }, tooltip: tooltipDefaults() },
      scales: {
        x: {
          ticks: { color: MUTED, maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 16 },
          grid: { color: GRID },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: MUTED, precision: 0 },
          grid: { color: GRID },
          border: { display: false }
        }
      }
    }
  })
}

function buildHorizontalBarChart(canvas, labels, values, datasetLabel, onSelect, { multicolor = false } = {}) {
  const colors = multicolor
    ? categoryColors(labels.length)
    : null
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: datasetLabel,
        data: values,
        backgroundColor: colors ? colors.map((c) => c.fill) : GOLD_SOFT,
        borderColor: colors ? colors.map((c) => c.stroke) : GOLD,
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 28
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event, elements) => {
        if (!onSelect || !elements.length) return
        onSelect(labels[elements[0].index], elements[0].index)
      },
      plugins: { legend: { display: false }, tooltip: tooltipDefaults() },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: MUTED, precision: 0 },
          grid: { color: GRID },
          border: { display: false }
        },
        y: {
          ticks: { color: MUTED, autoSkip: false },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  })
}

function buildDoughnutChart(canvas, labels, values, colors, onSelect) {
  const safeValues = values.map((v) => Number(v) || 0)
  if (safeValues.every((v) => v <= 0)) {
    return null
  }
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: safeValues,
        backgroundColor: colors,
        borderColor: '#0f172a',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event, elements) => {
        if (!onSelect || !elements.length) return
        onSelect(labels[elements[0].index], elements[0].index)
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: MUTED, boxWidth: 12 }
        },
        tooltip: tooltipDefaults()
      }
    }
  })
}

export default {
  name: 'StateOfSteam',
  setup() {
    const timeMachineOptions = getTimeMachineOptions()
    const selectedMonth = ref('this-month')
    const isLoading = ref(false)
    const error = ref('')
    const metrics = ref(null)
    const historicalError = ref('')
    let loadAbort = null

    const releasedChartEl = ref(null)
    const upcomingChartEl = ref(null)
    const genresChartEl = ref(null)
    const tagsChartEl = ref(null)
    const freePaidChartEl = ref(null)
    const scoreMixChartEl = ref(null)
    const sentimentChartEl = ref(null)

    /** @type {import('vue').Ref<null | { chart: string, title: string, loading: boolean, error: string, games: any[] }>} */
    const drill = ref(null)
    let drillToken = 0

    const charts = []

    const periodLabel = computed(() =>
      timeMachineOptions.find((o) => o.value === selectedMonth.value)?.label || 'This month'
    )

    const releasedMonthTotal = computed(() =>
      (metrics.value?.releasedInMonthDaily || []).reduce((sum, row) => sum + (row.count || 0), 0)
    )
    const dueNext7Total = computed(() =>
      (metrics.value?.dueNext7Days || []).reduce((sum, row) => sum + (row.count || 0), 0)
    )

    const bigNumberCards = computed(() => {
      const m = metrics.value
      if (!m) return []
      const histPending = m.historicalStatus === 'loading'
      return [
        { label: `Released — ${m.period.label}`, value: m.selectedMonthReleases, pending: false },
        {
          label: `Released — ${m.period.prevMonthLabel}`,
          value: m.previousMonthReleases,
          pending: histPending && m.previousMonthReleases == null
        },
        {
          label: `Released — ${m.period.yearLabel}`,
          value: m.selectedYearReleases,
          pending: histPending && m.selectedYearReleases == null
        },
        {
          label: `Released — ${m.period.prevYearLabel}`,
          value: m.previousYearReleases,
          pending: histPending && m.previousYearReleases == null
        },
        {
          label: `Released to date (thru ${m.period.label})`,
          value: m.releasedToDate,
          pending: histPending && m.releasedToDate == null
        }
      ]
    })

    const reviewStatCards = computed(() => {
      const t = metrics.value?.reviewTotals
      if (!t) return []
      const share = Number(t.positiveShare) || 0
      return [
        { label: 'Positive reviews', display: formatNumber(t.positive) },
        { label: 'Negative reviews', display: formatNumber(t.negative) },
        { label: 'Total reviews', display: formatNumber(t.total) },
        { label: 'Positive share', display: `${share.toFixed(1)}%` }
      ]
    })

    const sentimentBoards = computed(() => {
      const m = metrics.value
      if (!m) return []
      return [
        {
          title: 'Most loved',
          subtitle: 'Min 1000 reviews · by positive %',
          metricHeader: 'Love %',
          rows: m.mostLoved,
          format: (g) => `${g.loveRate.toFixed(1)}%`
        },
        {
          title: 'Most hated',
          subtitle: 'Min 1000 reviews · by negative %',
          metricHeader: 'Hate %',
          rows: m.mostHated,
          format: (g) => `${g.hateRate.toFixed(1)}%`
        },
        {
          title: 'Most mixed',
          subtitle: 'Closest to 50/50 · min 1000 reviews',
          metricHeader: 'Pos %',
          rows: m.mostMixed,
          format: (g) => `${g.loveRate.toFixed(1)}%`
        }
      ]
    })

    const studioBoards = computed(() => {
      const m = metrics.value
      if (!m) return []
      return [
        {
          title: 'Most prolific publishers',
          subtitle: `Games released in ${m.period.label}`,
          nameHeader: 'Publisher',
          metricHeader: 'Reviews',
          rows: m.prolificPublishers,
          format: (s) => formatNumber(s.reviews)
        },
        {
          title: 'Most prolific developers',
          subtitle: `Games released in ${m.period.label}`,
          nameHeader: 'Developer',
          metricHeader: 'Reviews',
          rows: m.prolificDevelopers,
          format: (s) => formatNumber(s.reviews)
        },
        {
          title: 'Most revered publishers',
          subtitle: 'Min 100 reviews · by love rate',
          nameHeader: 'Publisher',
          metricHeader: 'Love %',
          rows: m.reveredPublishers,
          format: (s) => `${s.loveRate.toFixed(1)}%`
        },
        {
          title: 'Most revered developers',
          subtitle: 'Min 100 reviews · by love rate',
          nameHeader: 'Developer',
          metricHeader: 'Love %',
          rows: m.reveredDevelopers,
          format: (s) => `${s.loveRate.toFixed(1)}%`
        }
      ]
    })

    const formatNumber = (value) => {
      const n = Number(value) || 0
      return n.toLocaleString()
    }

    const destroyCharts = () => {
      while (charts.length) {
        const chart = charts.pop()
        chart.destroy()
      }
    }

    const track = (chart) => {
      if (chart) charts.push(chart)
      return chart
    }

    const safeChart = (fn) => {
      try {
        return track(fn())
      } catch (err) {
        console.warn('Chart render skipped:', err)
        return null
      }
    }

    const clearDrill = async () => {
      drillToken += 1
      const wasOpen = !!drill.value
      drill.value = null
      if (wasOpen) await renderCharts()
    }

    const openDrill = async (chart, title, queryOpts) => {
      const token = ++drillToken
      drill.value = { chart, title, loading: true, error: '', games: [] }
      destroyCharts()
      try {
        const games = await cubeService.getStateOfSteamDrilldownGames({
          dateRange: metrics.value?.period?.range,
          ...queryOpts
        })
        if (token !== drillToken) return
        drill.value = { chart, title, loading: false, error: '', games }
      } catch (err) {
        console.error('Drill-down failed:', err)
        if (token !== drillToken) return
        drill.value = {
          chart,
          title,
          loading: false,
          error: 'Could not load games for this selection.',
          games: []
        }
      }
    }

    const onReleasedBarClick = (row) => {
      if (!row?.date) return
      openDrill('released', `Released ${formatDayLabel(row.date)}`, { day: row.date })
    }

    const onGenreBarClick = (genre) => {
      if (!genre) return
      openDrill('genres', `${genre} — ${metrics.value?.period?.label || ''}`, { genre })
    }

    const onTagBarClick = (tag) => {
      if (!tag) return
      openDrill('tags', `${tag} — ${metrics.value?.period?.label || ''}`, { tag })
    }

    const onFreePaidSliceClick = (label) => {
      if (label !== 'Free' && label !== 'Paid') return
      const isFree = label === 'Free'
      openDrill('freePaid', `${label} games — ${metrics.value?.period?.label || ''}`, { isFree })
    }

    const onDocumentPointerDown = (event) => {
      if (!drill.value) return
      const root = event.target?.closest?.('[data-drill-root]')
      if (root && root.getAttribute('data-drill-root') === drill.value.chart) return
      clearDrill()
    }

    const renderCharts = async () => {
      await nextTick()
      destroyCharts()
      const m = metrics.value
      if (!m || drill.value) return

      if (releasedChartEl.value && m.releasedInMonthDaily?.length) {
        safeChart(() => buildDayBarChart(
          releasedChartEl.value,
          m.releasedInMonthDaily,
          'Released',
          onReleasedBarClick
        ))
      }
      if (m.period.isCurrent && upcomingChartEl.value && m.dueNext7Days?.length) {
        safeChart(() => buildDayBarChart(upcomingChartEl.value, m.dueNext7Days, 'Due'))
      }
      if (genresChartEl.value && m.genresInMonth?.length) {
        safeChart(() => buildHorizontalBarChart(
          genresChartEl.value,
          m.genresInMonth.map((r) => r.genre),
          m.genresInMonth.map((r) => r.count),
          'Games',
          onGenreBarClick,
          { multicolor: true }
        ))
      }
      if (tagsChartEl.value && m.tagsInMonth?.length) {
        safeChart(() => buildHorizontalBarChart(
          tagsChartEl.value,
          m.tagsInMonth.map((r) => r.tag),
          m.tagsInMonth.map((r) => r.count),
          'Games',
          onTagBarClick,
          { multicolor: true }
        ))
      }
      if (scoreMixChartEl.value && m.reviewScoreMix?.length) {
        safeChart(() => buildHorizontalBarChart(
          scoreMixChartEl.value,
          m.reviewScoreMix.map((r) => r.score),
          m.reviewScoreMix.map((r) => r.count),
          'Games'
        ))
      }
      if (freePaidChartEl.value) {
        safeChart(() => buildDoughnutChart(
          freePaidChartEl.value,
          ['Free', 'Paid'],
          [m.freeVsPaid?.free, m.freeVsPaid?.paid],
          [GOLD, SLATE],
          onFreePaidSliceClick
        ))
      }
      if (sentimentChartEl.value) {
        safeChart(() => buildDoughnutChart(
          sentimentChartEl.value,
          ['Positive', 'Negative'],
          [m.reviewTotals?.positive, m.reviewTotals?.negative],
          [POSITIVE_GREEN, NEGATIVE_RED]
        ))
      }
    }

    const loadMetrics = async () => {
      if (loadAbort) loadAbort.abort()
      loadAbort = new AbortController()
      const { signal } = loadAbort

      isLoading.value = true
      error.value = ''
      historicalError.value = ''
      metrics.value = null
      drill.value = null
      drillToken += 1
      try {
        metrics.value = await cubeService.getStateOfSteamMetrics(selectedMonth.value, {
          signal,
          onHistorical: (hist) => {
            if (signal.aborted || !metrics.value) return
            metrics.value = { ...metrics.value, ...hist }
            historicalError.value = hist.historicalError || ''
          }
        })
        if (signal.aborted) return
        historicalError.value = metrics.value?.historicalError || ''
        await renderCharts()
      } catch (err) {
        if (err?.name === 'AbortError' || signal.aborted) return
        console.error('State of Steam metrics failed:', err)
        metrics.value = null
        error.value = 'Could not load Steam metrics. Check your Cube connection and try again.'
      } finally {
        if (!signal.aborted) isLoading.value = false
      }
    }

    onMounted(() => {
      document.addEventListener('pointerdown', onDocumentPointerDown)
      loadMetrics()
    })

    onBeforeUnmount(() => {
      if (loadAbort) loadAbort.abort()
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      destroyCharts()
    })

    return {
      timeMachineOptions,
      selectedMonth,
      isLoading,
      error,
      metrics,
      historicalError,
      periodLabel,
      releasedChartEl,
      upcomingChartEl,
      genresChartEl,
      tagsChartEl,
      freePaidChartEl,
      scoreMixChartEl,
      sentimentChartEl,
      drill,
      clearDrill,
      getItadUrl,
      releasedMonthTotal,
      dueNext7Total,
      bigNumberCards,
      reviewStatCards,
      sentimentBoards,
      studioBoards,
      formatNumber,
      loadMetrics
    }
  }
}
</script>

<style scoped>
.time-machine-label {
  color: var(--color-accent);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.time-machine-select {
  min-width: 9.5rem;
  background: var(--color-surface);
  border-color: rgba(212, 175, 55, 0.45);
  color: var(--color-text);
}

.period-banner {
  margin-bottom: var(--spacing-lg);
  font-size: 0.95rem;
}

.period-banner strong {
  color: var(--color-accent);
}

.source-pill {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-accent);
  border: 1px solid rgba(212, 175, 55, 0.35);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  vertical-align: middle;
}

.historical-note {
  margin: -0.5rem 0 1rem;
  font-size: 0.8rem;
}

.metric-pending {
  opacity: 0.55;
  letter-spacing: 0.15em;
}

.chart-panel {
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: var(--radius);
  padding: var(--spacing-lg);
  height: 100%;
}

.chart-title {
  margin: 0;
  color: var(--color-accent);
  font-family: var(--font-body);
  font-size: 1.05rem;
}

.chart-subtitle {
  margin: 0.25rem 0 1rem;
  font-size: 0.85rem;
}

.chart-wrap {
  position: relative;
  height: 240px;
}

.chart-wrap-clickable {
  cursor: pointer;
}

.chart-wrap-genres {
  height: min(520px, max(280px, calc(var(--genre-count, 12) * 28px)));
}

.chart-wrap-doughnut {
  height: 260px;
}

.drilldown-panel {
  min-height: 240px;
  max-height: 420px;
  display: flex;
  flex-direction: column;
}

.drilldown-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.drilldown-title {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 600;
}

.drilldown-status {
  padding: 0.5rem 0;
  font-size: 0.9rem;
}

.drilldown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  flex: 1;
}

.drilldown-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 1rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.drilldown-game-name {
  grid-column: 1 / -1;
  color: var(--color-text);
  font-weight: 600;
  font-size: 0.9rem;
}

.drilldown-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  font-size: 0.75rem;
}

.drilldown-links {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.8rem;
  white-space: nowrap;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.metric-card {
  background: rgba(15, 23, 42, 0.45);
  border: 1px solid rgba(212, 175, 55, 0.28);
  border-radius: var(--radius);
  padding: var(--spacing-lg) var(--spacing-md);
  text-align: center;
}

.metric-label {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  margin-bottom: var(--spacing-sm);
  text-transform: uppercase;
}

.metric-value {
  color: var(--color-accent);
  font-family: var(--font-body);
  font-size: clamp(1.35rem, 2.6vw, 2rem);
  font-weight: 700;
  line-height: 1.1;
}

.leaderboard {
  max-height: 360px;
  overflow: auto;
}

.leaderboard .table {
  font-size: 0.85rem;
}
</style>
