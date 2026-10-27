import { findGames, findDigMatches, ADULT_CONTENT_TAGS, resolveExcludedAppIds } from '../services/cubeService.js'
import { getTopTagsByCount } from '../services/tagsSearchEngine.js'
import { getItadUrl } from '../services/itadService.js'
import { constraintsOf, queryFromConstraints } from './digRules.js'

export const TAG_ROUND_COUNT = 3
export const TAGS_PER_ROUND = 7
const DIG_EXCLUDED_TAGS = ['Early Access', 'Indie', 'Action-Adventure', 'Casual']
const PAIRED_TAGS = ['2D', '3D']

function shuffle(list) {
  const pool = list.slice()
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = pool[index]
    pool[index] = pool[swap]
    pool[swap] = current
  }
  return pool
}

export async function loadTagPool() {
  const needed = TAG_ROUND_COUNT * TAGS_PER_ROUND
  const tags = await getTopTagsByCount(needed, [...ADULT_CONTENT_TAGS, ...DIG_EXCLUDED_TAGS])
  if (tags.length < needed) {
    throw new Error(`Expected ${needed} tags after dropping excluded tags, found ${tags.length}.`)
  }
  return tags
}

export function dealTagGroups(tags) {
  const paired = PAIRED_TAGS
    .map((name) => tags.find((tag) => tag.name === name))
    .filter(Boolean)
  const rest = shuffle(tags.filter((tag) => !PAIRED_TAGS.includes(tag.name)))
  const groups = Array.from({ length: TAG_ROUND_COUNT }, () => [])
  if (paired.length === PAIRED_TAGS.length) {
    const line = Math.floor(Math.random() * TAG_ROUND_COUNT)
    groups[line].push(...paired)
  } else {
    rest.push(...paired)
  }
  for (const group of groups) {
    while (group.length < TAGS_PER_ROUND && rest.length) group.push(rest.pop())
  }
  return groups.map((group) => shuffle(group))
}

export function warmAdultExclusion() {
  return resolveExcludedAppIds({ includeAdultGames: false }).catch(() => [])
}

function ymdFromCube(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
    return match ? match[1] : ''
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return ''
}

export async function fetchEarliestReleaseDate() {
  const rows = await findGames({
    tags: null,
    reviewScore: 'Any',
    reviewScores: null,
    minReviews: 0,
    maxReviews: 10000000,
    minDate: '1900-01-01',
    maxDate: '2019-12-31',
    limit: 1,
    reviewScoreOrBetter: false,
    hours: null,
    aiDeclaration: 'any',
    excludeTags: null,
    includeAdultGames: false,
    orderBy: 'release_date_asc',
    strict: true
  })
  return ymdFromCube(rows[0]?.['Games.releaseDate'])
}

export async function runDigSearch(picks) {
  const tags = (picks.tags || []).filter(Boolean)
  return findDigMatches({
    tags,
    reviewScores: picks.reviewScores?.length ? picks.reviewScores : null,
    minReviews: picks.minReviews || 0,
    maxReviews: picks.maxReviews == null ? 10000000 : picks.maxReviews,
    minDate: picks.minDate || null,
    maxDate: picks.maxDate || null,
    limit: 3
  })
}

export function mapDigGames(rows) {
  return (rows || []).slice(0, 3).map((row) => {
    const positive = Number(row['Games.totalPositiveReviews']) || 0
    const negative = Number(row['Games.totalNegativeReviews']) || 0
    const total = Number(row['Games.totalReviewsValue'])
    const appId = Math.round(Number(row['Games.appId']))
    return {
      appId,
      name: row['Games.name'] || 'Untitled',
      reviewScoreDesc: row['Games.reviewScoreDesc'] || '',
      releaseDate: ymdFromCube(row['Games.releaseDate']),
      totalReviews: Number.isFinite(total) ? Math.round(total) : Math.round(positive + negative),
      positive: Math.round(positive),
      negative: Math.round(negative),
      url: Number.isFinite(appId) ? `https://store.steampowered.com/app/${appId}` : '',
      itadUrl: getItadUrl(row['Games.name'] || '')
    }
  })
}

/**
 * Name the constraint that emptied the list.
 * Walks from the last pick backward. The latest pick whose removal
 * restores results (any game, when the list is empty; three games otherwise)
 * is that constraint. If no single pick restores them, the first pick in
 * order that drops the running search under that bar is used.
 */
export async function nameEmptiedConstraint(picks, fullCount) {
  const constraints = constraintsOf(picks)
  const target = fullCount === 0 ? 1 : 3
  for (let index = constraints.length - 1; index >= 0; index -= 1) {
    const relaxed = queryFromConstraints(constraints.filter((_, other) => other !== index))
    const rows = await runDigSearch(relaxed)
    if (rows.length >= target) return constraints[index].name
  }
  for (let index = 0; index < constraints.length; index += 1) {
    const rows = await runDigSearch(queryFromConstraints(constraints.slice(0, index + 1)))
    if (rows.length < target) return constraints[index].name
  }
  return constraints[constraints.length - 1]?.name || 'the combined filters'
}
