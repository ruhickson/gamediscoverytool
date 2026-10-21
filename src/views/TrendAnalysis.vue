<template>
  <div class="trend-analysis">
    <div class="card">
      <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <h5 class="mb-0"><i class="fas fa-chart-line"></i> Trend Analysis</h5>
        <div class="d-flex flex-wrap align-items-center gap-2">
          <label class="time-machine-label mb-0" for="trendTimeMachine">
            <i class="fas fa-clock"></i> Time Machine
          </label>
          <select
            id="trendTimeMachine"
            class="form-select form-select-sm time-machine-select"
            v-model="selectedMonth"
            :disabled="isLoading && !trends"
            @change="loadTrends"
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
            :disabled="isLoading && !trends"
            @click="loadTrends"
            title="Refresh trends"
          >
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoading }"></i>
            Refresh
          </button>
        </div>
      </div>
      <div class="card-body">
        <div v-if="error" class="error">{{ error }}</div>

        <div v-if="isLoading && !trends" class="loading">
          Loading trends for {{ periodLabel }}…
        </div>

        <template v-if="trends">
          <p class="period-banner text-muted">
            Change in games released from
            <strong>{{ previousCaption }}</strong>
            to
            <strong>{{ currentCaption }}</strong>.
            <span v-if="trends.period.compareToDate">
              This month is still in progress, so last month is cut off on the same day.
            </span>
          </p>

          <div class="row g-3">
            <div class="col-12">
              <div
                class="chart-panel"
                data-drill-root="genres"
                @pointerdown.stop
              >
                <h6 class="chart-title">Genres</h6>
                <p class="chart-subtitle text-muted">
                  Ordered by {{ currentCaption }} count
                  <span v-if="drill?.chart !== 'genres'"> · click a row for games</span>
                </p>
                <div class="chart-filter">
                  <input
                    type="text"
                    class="form-control form-control-sm chart-filter-input"
                    v-model="genreFilter.query"
                    placeholder="Search genres…"
                    autocomplete="off"
                    role="combobox"
                    aria-label="Search genres"
                    :aria-expanded="genreFilter.open ? 'true' : 'false'"
                    aria-controls="trendGenreFilterList"
                    @focus="openCategoryFilter('genre')"
                    @click="openCategoryFilter('genre')"
                    @input="onCategoryFilterInput('genre')"
                    @keydown="onCategoryFilterKeydown('genre', $event)"
                    @blur="closeCategoryFilterSoon('genre')"
                  >
                  <ul
                    v-if="genreFilter.open"
                    id="trendGenreFilterList"
                    class="chart-filter-menu"
                    role="listbox"
                  >
                    <li v-if="genreFilter.loading && !genreFilter.options.length" class="chart-filter-status">Searching…</li>
                    <li v-else-if="!genreFilter.options.length" class="chart-filter-status">No matching genres</li>
                    <li
                      v-for="(option, index) in genreFilter.options"
                      :key="option.name"
                      role="option"
                      class="chart-filter-option"
                      :class="{ active: index === genreFilter.active }"
                      @mousedown.prevent="selectCategory('genre', option.name)"
                    >
                      <span>{{ option.name }}</span>
                      <span class="text-muted">{{ formatNumber(option.count) }}</span>
                    </li>
                  </ul>
                </div>
                <div class="dumbbell-legend" aria-hidden="true">
                  <span class="legend-item"><i class="legend-dot legend-dot-previous"></i> {{ previousCaption }}</span>
                  <span class="legend-item"><i class="legend-dot legend-dot-current"></i> {{ currentCaption }}</span>
                </div>
                <div v-if="drill?.chart === 'genres'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                    <div class="drill-side-toggle">
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'previous' }"
                        @click="setDrillSide('previous')"
                      >
                        {{ previousCaption }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'current' }"
                        @click="setDrillSide('current')"
                      >
                        {{ currentCaption }}
                      </button>
                    </div>
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
                  class="chart-wrap chart-wrap-dumbbell"
                  :class="{ 'chart-wrap-clickable': trends.genres.length }"
                  :style="{ '--row-count': trends.genres.length || 8 }"
                >
                  <div v-if="!trends.genres.length" class="chart-loader text-muted">No genre releases in this window.</div>
                  <canvas
                    v-else
                    ref="genresChartEl"
                    role="img"
                    :aria-label="`Genre dumbbell chart, ${previousCaption} to ${currentCaption}`"
                  ></canvas>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div
                class="chart-panel"
                data-drill-root="genreShares"
                @pointerdown.stop
              >
                <h6 class="chart-title">Genres, share of releases</h6>
                <p class="chart-subtitle text-muted">
                  Share of all games released in each period.
                  {{ currentCaption }}: {{ formatNumber(trends.period.currentTotal) }} games.
                  {{ previousCaption }}: {{ formatNumber(trends.period.previousTotal) }} games.
                  A game can count toward more than one genre.
                  Ordered by this period's share
                  <span v-if="drill?.chart !== 'genreShares'"> · click a row for games</span>
                </p>
                <div class="dumbbell-legend" aria-hidden="true">
                  <span class="legend-item"><i class="legend-dot legend-dot-previous"></i> {{ previousCaption }}</span>
                  <span class="legend-item"><i class="legend-dot legend-dot-current"></i> {{ currentCaption }}</span>
                </div>
                <div v-if="drill?.chart === 'genreShares'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                    <div class="drill-side-toggle">
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'previous' }"
                        @click="setDrillSide('previous')"
                      >
                        {{ previousCaption }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'current' }"
                        @click="setDrillSide('current')"
                      >
                        {{ currentCaption }}
                      </button>
                    </div>
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
                  class="chart-wrap chart-wrap-dumbbell"
                  :class="{ 'chart-wrap-clickable': genreShareRows.length }"
                  :style="{ '--row-count': genreShareRows.length || 8 }"
                >
                  <div v-if="!genreShareRows.length" class="chart-loader text-muted">No genre releases in this window.</div>
                  <canvas
                    v-else
                    ref="genreSharesChartEl"
                    role="img"
                    :aria-label="`Genre share dumbbell chart, ${previousCaption} to ${currentCaption}`"
                  ></canvas>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div
                class="chart-panel"
                data-drill-root="tags"
                @pointerdown.stop
              >
                <h6 class="chart-title">Tags</h6>
                <p class="chart-subtitle text-muted">
                  Ordered by {{ currentCaption }} count
                  <template v-if="trends.tags.length">
                    · {{ tagPageStart }}–{{ tagPageEnd }} of {{ formatNumber(trends.tags.length) }}
                  </template>
                  <span v-if="drill?.chart !== 'tags'"> · click a row for games</span>
                </p>
                <div class="chart-filter">
                  <input
                    type="text"
                    class="form-control form-control-sm chart-filter-input"
                    v-model="tagFilter.query"
                    placeholder="Search tags…"
                    autocomplete="off"
                    role="combobox"
                    aria-label="Search tags"
                    :aria-expanded="tagFilter.open ? 'true' : 'false'"
                    aria-controls="trendTagFilterList"
                    @focus="openCategoryFilter('tag')"
                    @click="openCategoryFilter('tag')"
                    @input="onCategoryFilterInput('tag')"
                    @keydown="onCategoryFilterKeydown('tag', $event)"
                    @blur="closeCategoryFilterSoon('tag')"
                  >
                  <ul
                    v-if="tagFilter.open"
                    id="trendTagFilterList"
                    class="chart-filter-menu"
                    role="listbox"
                  >
                    <li v-if="tagFilter.loading && !tagFilter.options.length" class="chart-filter-status">Searching…</li>
                    <li v-else-if="!tagFilter.options.length" class="chart-filter-status">No matching tags</li>
                    <li
                      v-for="(option, index) in tagFilter.options"
                      :key="option.name"
                      role="option"
                      class="chart-filter-option"
                      :class="{ active: index === tagFilter.active }"
                      @mousedown.prevent="selectCategory('tag', option.name)"
                    >
                      <span>{{ option.name }}</span>
                      <span class="text-muted">{{ formatNumber(option.count) }}</span>
                    </li>
                  </ul>
                </div>
                <div class="dumbbell-legend" aria-hidden="true">
                  <span class="legend-item"><i class="legend-dot legend-dot-previous"></i> {{ previousCaption }}</span>
                  <span class="legend-item"><i class="legend-dot legend-dot-current"></i> {{ currentCaption }}</span>
                </div>
                <div v-if="drill?.chart === 'tags'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                    <div class="drill-side-toggle">
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'previous' }"
                        @click="setDrillSide('previous')"
                      >
                        {{ previousCaption }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'current' }"
                        @click="setDrillSide('current')"
                      >
                        {{ currentCaption }}
                      </button>
                    </div>
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
                  class="chart-wrap chart-wrap-dumbbell"
                  :class="{ 'chart-wrap-clickable': pagedTags.length }"
                  :style="{ '--row-count': pagedTags.length || 8 }"
                >
                  <div v-if="!trends.tags.length" class="chart-loader text-muted">No tag releases in this window.</div>
                  <canvas
                    v-else
                    ref="tagsChartEl"
                    role="img"
                    :aria-label="`Tag dumbbell chart, ${previousCaption} to ${currentCaption}`"
                  ></canvas>
                </div>
                <div v-if="tagPageCount > 1 && drill?.chart !== 'tags'" class="trend-pager">
                  <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    :disabled="tagPage === 0"
                    @click="tagPage -= 1"
                  >
                    Previous
                  </button>
                  <span class="text-muted">Page {{ tagPage + 1 }} of {{ tagPageCount }}</span>
                  <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    :disabled="tagPage >= tagPageCount - 1"
                    @click="tagPage += 1"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div class="col-12">
              <div
                class="chart-panel"
                data-drill-root="tagShares"
                @pointerdown.stop
              >
                <h6 class="chart-title">Tags, share of releases</h6>
                <p class="chart-subtitle text-muted">
                  Share of all games released in each period.
                  {{ currentCaption }}: {{ formatNumber(trends.period.currentTotal) }} games.
                  {{ previousCaption }}: {{ formatNumber(trends.period.previousTotal) }} games.
                  A game can count toward more than one tag.
                  Ordered by this period's share
                  <template v-if="tagShareRows.length">
                    · {{ tagSharePageStart }}–{{ tagSharePageEnd }} of {{ formatNumber(tagShareRows.length) }}
                  </template>
                  <span v-if="drill?.chart !== 'tagShares'"> · click a row for games</span>
                </p>
                <div class="dumbbell-legend" aria-hidden="true">
                  <span class="legend-item"><i class="legend-dot legend-dot-previous"></i> {{ previousCaption }}</span>
                  <span class="legend-item"><i class="legend-dot legend-dot-current"></i> {{ currentCaption }}</span>
                </div>
                <div v-if="drill?.chart === 'tagShares'" class="drilldown-panel">
                  <div class="drilldown-header">
                    <button type="button" class="btn btn-outline-light btn-sm" @click="clearDrill">
                      <i class="fas fa-arrow-left"></i> Back to chart
                    </button>
                    <span class="drilldown-title">{{ drill.title }}</span>
                    <div class="drill-side-toggle">
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'previous' }"
                        @click="setDrillSide('previous')"
                      >
                        {{ previousCaption }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-light btn-sm"
                        :class="{ active: drill.side === 'current' }"
                        @click="setDrillSide('current')"
                      >
                        {{ currentCaption }}
                      </button>
                    </div>
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
                  class="chart-wrap chart-wrap-dumbbell"
                  :class="{ 'chart-wrap-clickable': pagedTagShares.length }"
                  :style="{ '--row-count': pagedTagShares.length || 8 }"
                >
                  <div v-if="!tagShareRows.length" class="chart-loader text-muted">No tag releases in this window.</div>
                  <canvas
                    v-else
                    ref="tagSharesChartEl"
                    role="img"
                    :aria-label="`Tag share dumbbell chart, ${previousCaption} to ${currentCaption}`"
                  ></canvas>
                </div>
                <div v-if="tagSharePageCount > 1 && drill?.chart !== 'tagShares'" class="trend-pager">
                  <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    :disabled="tagSharePage === 0"
                    @click="tagSharePage -= 1"
                  >
                    Previous
                  </button>
                  <span class="text-muted">Page {{ tagSharePage + 1 }} of {{ tagSharePageCount }}</span>
                  <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    :disabled="tagSharePage >= tagSharePageCount - 1"
                    @click="tagSharePage += 1"
                  >
                    Next
                  </button>
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
import { ref, reactive, computed, inject, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js'
import cubeService from '../services/cubeService'
import { getItadUrl } from '../services/itadService'
import { getTimeMachineOptions } from '../utils/timeMachine'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const TAG_PAGE_SIZE = 15
const GOLD = '#d4af37'
const MUTED = '#94a3b8'
const GRID = 'rgba(148, 163, 184, 0.18)'
const HC_WHITE = '#ffffff'
const HC_GREY = '#c0c0c0'
const HC_GRID = 'rgba(255, 255, 255, 0.28)'

function rangeCaption(range) {
  if (!range || range.length !== 2) return ''
  const [start, end] = range
  const [year, month, startDay] = start.split('-').map(Number)
  const endDay = Number(end.slice(8, 10))
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  return `${monthName} ${startDay}–${endDay}, ${year}`
}

function tooltipDefaults(highContrast = false) {
  if (highContrast) {
    return {
      backgroundColor: '#000000',
      titleColor: HC_WHITE,
      bodyColor: HC_WHITE,
      borderColor: HC_WHITE,
      borderWidth: 1
    }
  }
  return {
    backgroundColor: '#1e293b',
    titleColor: GOLD,
    bodyColor: '#e8eef7',
    borderColor: 'rgba(212, 175, 55, 0.45)',
    borderWidth: 1
  }
}

function drawDot(ctx, x, y, color) {
  ctx.beginPath()
  ctx.fillStyle = color
  ctx.arc(x, y, 5.5, 0, Math.PI * 2)
  ctx.fill()
}

function formatShare(value) {
  return `${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function buildDumbbellChart(canvas, rows, previousLabel, currentLabel, onSelect, { highContrast = false, mode = 'count' } = {}) {
  const tick = highContrast ? HC_WHITE : MUTED
  const grid = highContrast ? HC_GRID : GRID
  const previousColor = highContrast ? HC_GREY : MUTED
  const currentColor = highContrast ? HC_WHITE : GOLD
  const lineColor = highContrast ? 'rgba(255, 255, 255, 0.55)' : 'rgba(148, 163, 184, 0.85)'
  const previousOf = (row) => (mode === 'share' ? row.previousShare : row.previous) || 0
  const currentOf = (row) => (mode === 'share' ? row.currentShare : row.current) || 0
  const formatValue = (value) => (mode === 'share' ? formatShare(value) : (Number(value) || 0).toLocaleString())

  const plugin = {
    id: 'dumbbellDots',
    afterDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0)
      const xScale = chart.scales.x
      const ctx = chart.ctx
      meta.data.forEach((bar, index) => {
        const row = rows[index]
        if (!row) return
        const y = bar.y
        const x0 = xScale.getPixelForValue(previousOf(row))
        const x1 = xScale.getPixelForValue(currentOf(row))
        ctx.save()
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
        ctx.stroke()
        drawDot(ctx, x0, y, previousColor)
        drawDot(ctx, x1, y, currentColor)
        ctx.restore()
      })
    }
  }

  return new Chart(canvas, {
    type: 'bar',
    plugins: [plugin],
    data: {
      labels: rows.map((row) => row.name),
      datasets: [{
        label: 'Change',
        data: rows.map((row) => [0, Math.max(previousOf(row), currentOf(row), mode === 'share' ? 0.1 : 1)]),
        backgroundColor: 'rgba(0, 0, 0, 0)',
        hoverBackgroundColor: 'rgba(0, 0, 0, 0)',
        borderWidth: 0,
        barThickness: 18
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', axis: 'y', intersect: false },
      onHover: (event, elements, chart) => {
        const target = event?.native?.target || chart.canvas
        if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
      },
      onClick: (_event, elements) => {
        if (!onSelect || !elements.length) return
        const row = rows[elements[0].index]
        if (row) onSelect(row)
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipDefaults(highContrast),
          displayColors: false,
          callbacks: {
            label(item) {
              const row = rows[item.dataIndex]
              if (!row) return ''
              const previous = previousOf(row)
              const current = currentOf(row)
              const delta = current - previous
              const sign = delta > 0 ? '+' : ''
              const change = mode === 'share'
                ? `${sign}${delta.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`
                : `${sign}${delta.toLocaleString()}`
              return [
                `${previousLabel}: ${formatValue(previous)}`,
                `${currentLabel}: ${formatValue(current)}`,
                `Change: ${change}`
              ]
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: mode === 'share'
            ? { color: tick, callback: (value) => formatShare(value) }
            : { color: tick, precision: 0 },
          grid: { color: grid },
          border: { display: false }
        },
        y: {
          ticks: { color: tick, autoSkip: false, font: { size: 11 } },
          grid: { display: false },
          border: { display: false }
        }
      }
    }
  })
}

export default {
  name: 'TrendAnalysis',
  setup() {
    const isHighContrast = inject('isHighContrast', ref(false))
    const timeMachineOptions = getTimeMachineOptions()
    const selectedMonth = ref('this-month')
    const isLoading = ref(false)
    const error = ref('')
    const trends = ref(null)
    const tagPage = ref(0)
    const tagSharePage = ref(0)
    const genresChartEl = ref(null)
    const genreSharesChartEl = ref(null)
    const tagsChartEl = ref(null)
    const tagSharesChartEl = ref(null)
    const drill = ref(null)
    let drillToken = 0
    let loadAbort = null

    const genreFilter = reactive({ query: '', open: false, loading: false, options: [], active: 0 })
    const tagFilter = reactive({ query: '', open: false, loading: false, options: [], active: 0 })
    const categoryFilters = { genre: genreFilter, tag: tagFilter }
    const categorySearchTimers = { genre: 0, tag: 0 }
    const categorySearchAborts = { genre: null, tag: null }

    const charts = { genres: null, genreShares: null, tags: null, tagShares: null }

    const byCurrentShare = (rows) => [...rows].sort((a, b) =>
      (b.currentShare || 0) - (a.currentShare || 0)
      || (b.previousShare || 0) - (a.previousShare || 0)
      || a.name.localeCompare(b.name)
    )

    const periodLabel = computed(() =>
      timeMachineOptions.find((opt) => opt.value === selectedMonth.value)?.label || 'This month'
    )
    const previousCaption = computed(() => rangeCaption(trends.value?.period?.previousRange) || 'Last month')
    const currentCaption = computed(() => rangeCaption(trends.value?.period?.range) || 'This month')
    const tagPageCount = computed(() =>
      Math.max(1, Math.ceil((trends.value?.tags?.length || 0) / TAG_PAGE_SIZE))
    )
    const pagedTags = computed(() => {
      const rows = trends.value?.tags || []
      const start = tagPage.value * TAG_PAGE_SIZE
      return rows.slice(start, start + TAG_PAGE_SIZE)
    })
    const tagPageStart = computed(() => (trends.value?.tags?.length ? tagPage.value * TAG_PAGE_SIZE + 1 : 0))
    const tagPageEnd = computed(() => Math.min((tagPage.value + 1) * TAG_PAGE_SIZE, trends.value?.tags?.length || 0))
    const genreShareRows = computed(() => byCurrentShare(trends.value?.genres || []))
    const tagShareRows = computed(() => byCurrentShare(trends.value?.tags || []))
    const tagSharePageCount = computed(() =>
      Math.max(1, Math.ceil(tagShareRows.value.length / TAG_PAGE_SIZE))
    )
    const pagedTagShares = computed(() => {
      const start = tagSharePage.value * TAG_PAGE_SIZE
      return tagShareRows.value.slice(start, start + TAG_PAGE_SIZE)
    })
    const tagSharePageStart = computed(() => (tagShareRows.value.length ? tagSharePage.value * TAG_PAGE_SIZE + 1 : 0))
    const tagSharePageEnd = computed(() => Math.min((tagSharePage.value + 1) * TAG_PAGE_SIZE, tagShareRows.value.length))

    const formatNumber = (value) => (Number(value) || 0).toLocaleString()

    const destroyChart = (kind) => {
      if (charts[kind]) {
        charts[kind].destroy()
        charts[kind] = null
      }
    }

    const destroyCharts = () => {
      destroyChart('genres')
      destroyChart('genreShares')
      destroyChart('tags')
      destroyChart('tagShares')
    }

    const drillCategory = (chart) => (chart === 'genres' || chart === 'genreShares' ? 'genres' : 'tags')

    const renderCharts = async () => {
      await nextTick()
      const data = trends.value
      if (!data) return
      const hc = !!isHighContrast.value
      const previousLabel = previousCaption.value
      const currentLabel = currentCaption.value

      if (drill.value?.chart !== 'genres' && genresChartEl.value && data.genres.length) {
        destroyChart('genres')
        charts.genres = buildDumbbellChart(
          genresChartEl.value,
          data.genres,
          previousLabel,
          currentLabel,
          (row) => openDrill('genres', row),
          { highContrast: hc }
        )
      }
      if (drill.value?.chart !== 'genreShares' && genreSharesChartEl.value && genreShareRows.value.length) {
        destroyChart('genreShares')
        charts.genreShares = buildDumbbellChart(
          genreSharesChartEl.value,
          genreShareRows.value,
          previousLabel,
          currentLabel,
          (row) => openDrill('genreShares', row),
          { highContrast: hc, mode: 'share' }
        )
      }
      if (drill.value?.chart !== 'tags' && tagsChartEl.value && pagedTags.value.length) {
        destroyChart('tags')
        charts.tags = buildDumbbellChart(
          tagsChartEl.value,
          pagedTags.value,
          previousLabel,
          currentLabel,
          (row) => openDrill('tags', row),
          { highContrast: hc }
        )
      }
      if (drill.value?.chart !== 'tagShares' && tagSharesChartEl.value && pagedTagShares.value.length) {
        destroyChart('tagShares')
        charts.tagShares = buildDumbbellChart(
          tagSharesChartEl.value,
          pagedTagShares.value,
          previousLabel,
          currentLabel,
          (row) => openDrill('tagShares', row),
          { highContrast: hc, mode: 'share' }
        )
      }
    }

    const loadDrillGames = async (nextDrill) => {
      const token = ++drillToken
      const period = trends.value?.period
      const dateRange = nextDrill.side === 'previous' ? period?.previousRange : period?.range
      const caption = nextDrill.side === 'previous' ? previousCaption.value : currentCaption.value
      drill.value = {
        ...nextDrill,
        title: `${nextDrill.name}: ${caption}`,
        loading: true,
        error: '',
        games: []
      }
      try {
        const category = nextDrill.category || drillCategory(nextDrill.chart)
        const games = await cubeService.getStateOfSteamDrilldownGames({
          dateRange,
          genre: category === 'genres' ? nextDrill.name : null,
          tag: category === 'tags' ? nextDrill.name : null
        })
        if (token !== drillToken) return
        drill.value = { ...drill.value, loading: false, error: '', games }
      } catch (err) {
        console.error('Trend drill-down failed:', err)
        if (token !== drillToken) return
        drill.value = {
          ...drill.value,
          loading: false,
          error: 'Could not load games for this selection.',
          games: []
        }
      }
    }

    const openDrill = async (chart, row, side = 'current') => {
      if (!row?.name) return
      destroyChart(chart)
      await loadDrillGames({ chart, category: drillCategory(chart), name: row.name, side })
    }

    const setDrillSide = (side) => {
      if (!drill.value || drill.value.side === side) return
      loadDrillGames({
        chart: drill.value.chart,
        category: drill.value.category || drillCategory(drill.value.chart),
        name: drill.value.name,
        side
      })
    }

    const clearDrill = async () => {
      drillToken += 1
      const wasOpen = !!drill.value
      drill.value = null
      if (wasOpen) await renderCharts()
    }

    const chartCategoryOptions = (kind, query) => {
      const q = String(query || '').trim().toLowerCase()
      const rows = kind === 'genre' ? (trends.value?.genres || []) : (trends.value?.tags || [])
      return rows
        .filter((row) => row.name && (!q || row.name.toLowerCase().includes(q)))
        .slice(0, 12)
        .map((row) => ({ name: row.name, count: row.current }))
    }

    const resetCategoryFilters = () => {
      for (const kind of ['genre', 'tag']) {
        clearTimeout(categorySearchTimers[kind])
        if (categorySearchAborts[kind]) categorySearchAborts[kind].abort()
        const filter = categoryFilters[kind]
        filter.query = ''
        filter.open = false
        filter.loading = false
        filter.options = []
        filter.active = 0
      }
    }

    const openCategoryFilter = (kind) => {
      const filter = categoryFilters[kind]
      filter.open = true
      filter.active = 0
      const q = filter.query.trim()
      if (!q) {
        filter.loading = false
        filter.options = chartCategoryOptions(kind, '')
        return
      }
      if (!filter.options.length) filter.options = chartCategoryOptions(kind, q)
    }

    const closeCategoryFilterSoon = (kind) => {
      setTimeout(() => {
        categoryFilters[kind].open = false
      }, 150)
    }

    const runCategorySearch = async (kind) => {
      const filter = categoryFilters[kind]
      const q = filter.query.trim()
      if (!q) return
      if (categorySearchAborts[kind]) categorySearchAborts[kind].abort()
      const controller = new AbortController()
      categorySearchAborts[kind] = controller
      filter.loading = true
      try {
        const options = await cubeService.searchStateOfSteamCategories({
          kind,
          dateRange: trends.value?.period?.range,
          query: q,
          signal: controller.signal
        })
        if (controller.signal.aborted || filter.query.trim() !== q) return
        filter.options = options
        filter.active = 0
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return
        console.warn('Category search failed:', err)
      } finally {
        if (categorySearchAborts[kind] === controller) filter.loading = false
      }
    }

    const onCategoryFilterInput = (kind) => {
      const filter = categoryFilters[kind]
      filter.open = true
      filter.active = 0
      const q = filter.query.trim()
      filter.options = chartCategoryOptions(kind, q)
      clearTimeout(categorySearchTimers[kind])
      if (!q) {
        if (categorySearchAborts[kind]) categorySearchAborts[kind].abort()
        filter.loading = false
        return
      }
      filter.loading = true
      categorySearchTimers[kind] = setTimeout(() => runCategorySearch(kind), 250)
    }

    const selectCategory = (kind, name) => {
      if (!name) return
      const filter = categoryFilters[kind]
      filter.query = name
      filter.open = false
      const rows = kind === 'genre' ? trends.value?.genres : trends.value?.tags
      const row = rows?.find((item) => item.name === name) || { name }
      openDrill(kind === 'genre' ? 'genres' : 'tags', row)
    }

    const onCategoryFilterKeydown = (kind, event) => {
      const filter = categoryFilters[kind]
      if (event.key === 'Escape') {
        filter.open = false
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (!filter.open) openCategoryFilter(kind)
        if (!filter.options.length) return
        const delta = event.key === 'ArrowDown' ? 1 : -1
        filter.active = (filter.active + delta + filter.options.length) % filter.options.length
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        const option = filter.options[filter.active] || filter.options[0]
        if (option) selectCategory(kind, option.name)
      }
    }

    const onDocumentPointerDown = (event) => {
      if (!drill.value) return
      const root = event.target?.closest?.('[data-drill-root]')
      if (root && root.getAttribute('data-drill-root') === drill.value.chart) return
      clearDrill()
    }

    const loadTrends = async () => {
      if (loadAbort) loadAbort.abort()
      loadAbort = new AbortController()
      const { signal } = loadAbort
      isLoading.value = true
      error.value = ''
      trends.value = null
      drill.value = null
      drillToken += 1
      tagPage.value = 0
      tagSharePage.value = 0
      resetCategoryFilters()
      destroyCharts()
      try {
        const result = await cubeService.getTrendAnalysis(selectedMonth.value, { signal })
        if (signal.aborted) return
        trends.value = result
        await renderCharts()
      } catch (err) {
        if (err?.name === 'AbortError' || signal.aborted) return
        console.error('Trend analysis failed:', err)
        trends.value = null
        error.value = 'Could not load trend data. Check your Cube connection and try again.'
      } finally {
        if (!signal.aborted) isLoading.value = false
      }
    }

    watch(isHighContrast, () => {
      renderCharts()
    })

    watch(tagPage, () => {
      if (drill.value?.chart === 'tags') {
        drill.value = null
        drillToken += 1
      }
      renderCharts()
    })

    watch(tagSharePage, () => {
      if (drill.value?.chart === 'tagShares') {
        drill.value = null
        drillToken += 1
      }
      renderCharts()
    })

    onMounted(() => {
      document.addEventListener('pointerdown', onDocumentPointerDown)
      loadTrends()
    })

    onBeforeUnmount(() => {
      if (loadAbort) loadAbort.abort()
      resetCategoryFilters()
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      destroyCharts()
    })

    return {
      timeMachineOptions,
      selectedMonth,
      isLoading,
      error,
      trends,
      periodLabel,
      previousCaption,
      currentCaption,
      tagPage,
      tagPageCount,
      tagPageStart,
      tagPageEnd,
      pagedTags,
      tagSharePage,
      tagSharePageCount,
      tagSharePageStart,
      tagSharePageEnd,
      tagShareRows,
      pagedTagShares,
      genreShareRows,
      genresChartEl,
      genreSharesChartEl,
      tagsChartEl,
      tagSharesChartEl,
      drill,
      genreFilter,
      tagFilter,
      formatNumber,
      getItadUrl,
      loadTrends,
      clearDrill,
      setDrillSide,
      openCategoryFilter,
      onCategoryFilterInput,
      onCategoryFilterKeydown,
      closeCategoryFilterSoon,
      selectCategory
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
  margin: 0.25rem 0 0.75rem;
  font-size: 0.85rem;
}

.chart-filter {
  position: relative;
  margin-bottom: 0.85rem;
}

.chart-filter-input {
  background: var(--color-surface);
  border-color: rgba(212, 175, 55, 0.45);
  color: var(--color-text);
}

.chart-filter-input:focus {
  background: var(--color-surface);
  border-color: var(--color-accent);
  color: var(--color-text);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.chart-filter-menu {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.2rem);
  left: 0;
  right: 0;
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  max-height: 220px;
  overflow: auto;
  background: #0f172a;
  border: 1px solid rgba(212, 175, 55, 0.45);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}

.chart-filter-option,
.chart-filter-status {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
}

.chart-filter-option {
  cursor: pointer;
  color: var(--color-text);
}

.chart-filter-option.active,
.chart-filter-option:hover {
  background: rgba(212, 175, 55, 0.16);
}

.chart-filter-status {
  color: var(--color-text-muted);
}

.dumbbell-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.75rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.legend-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  display: inline-block;
}

.legend-dot-previous {
  background: #94a3b8;
}

.legend-dot-current {
  background: #d4af37;
}

.chart-wrap {
  position: relative;
}

.chart-wrap-dumbbell {
  height: max(240px, calc(var(--row-count, 12) * 32px));
}

:global(.hc-contrast) .legend-dot-previous {
  background: #c0c0c0;
}

:global(.hc-contrast) .legend-dot-current {
  background: #ffffff;
}

.chart-wrap-clickable {
  cursor: pointer;
}

.chart-loader {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trend-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.85rem;
  font-size: 0.85rem;
}

.drilldown-panel {
  min-height: 240px;
  max-height: 520px;
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

.drill-side-toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-left: auto;
}

.drill-side-toggle .btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #0f172a;
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
</style>
