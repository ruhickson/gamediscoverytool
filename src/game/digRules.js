import { formatDay, splitWindow, todayYmd } from './digDates.js'

// Least strict first. "At least" keeps the chosen label and every label after it.
export const SCORE_LADDER = [
  'Mostly Positive',
  'Positive',
  'Very Positive',
  'Overwhelmingly Positive'
]

export function scoresAtLeast(label) {
  const index = SCORE_LADDER.indexOf(label)
  if (index === -1) return [label]
  return SCORE_LADDER.slice(index)
}

export function freshPicks() {
  return {
    tags: [],
    minDate: '',
    maxDate: '',
    dateLabel: '',
    coarseMin: '',
    coarseMax: '',
    skipDateSplit: false,
    reviewScores: null,
    scoreLabel: '',
    minReviews: 0,
    maxReviews: 10000000,
    reviewCountLabel: '',
    history: []
  }
}

export function resetPicks(picks) {
  const next = freshPicks()
  picks.tags.splice(0, picks.tags.length, ...next.tags)
  picks.history.splice(0, picks.history.length, ...next.history)
  picks.minDate = next.minDate
  picks.maxDate = next.maxDate
  picks.dateLabel = next.dateLabel
  picks.coarseMin = next.coarseMin
  picks.coarseMax = next.coarseMax
  picks.skipDateSplit = next.skipDateSplit
  picks.reviewScores = next.reviewScores
  picks.scoreLabel = next.scoreLabel
  picks.minReviews = next.minReviews
  picks.maxReviews = next.maxReviews
  picks.reviewCountLabel = next.reviewCountLabel
}

export function tagEncounter(group, index) {
  return {
    kind: 'tags',
    prompt: `Which tag should this include? (${index + 1} of 6)`,
    detail: 'The search requires every tag you pick.',
    options: group.map((tag) => ({
      id: tag.name,
      label: tag.name,
      detail: `${Number(tag.count).toLocaleString('en-US')} games`,
      effect: { type: 'tag', tag: tag.name }
    }))
  }
}

export function recencyEncounter(today = todayYmd(), earliest = '') {
  const year = Number(today.slice(0, 4))
  const thisYear = { minDate: `${year}-01-01`, maxDate: today }
  const since2020 = { minDate: '2020-01-01', maxDate: `${year - 1}-12-31` }
  const before2020 = { minDate: earliest || '', maxDate: '2019-12-31' }
  const windows = [
    {
      id: 'this-year',
      label: 'This year',
      ...thisYear,
      detail: `${formatDay(thisYear.minDate)} – ${formatDay(thisYear.maxDate)}`
    },
    {
      id: 'since-2020',
      label: '2020 through last year',
      ...since2020,
      detail: `${formatDay(since2020.minDate)} – ${formatDay(since2020.maxDate)}`
    },
    {
      id: 'before-2020',
      label: 'Before 2020',
      ...before2020,
      detail: earliest
        ? `${formatDay(earliest)} – ${formatDay(before2020.maxDate)}`
        : 'Earliest release on record through 31 Dec 2019'
    },
    {
      id: 'any',
      label: "Doesn't matter",
      minDate: '',
      maxDate: '',
      detail: 'No date clause. Skips the next stop.'
    }
  ]
  return {
    kind: 'recency',
    prompt: 'When did it come out?',
    detail: 'One release-date range, or none.',
    options: windows.map((window) => ({
      id: window.id,
      label: window.label,
      detail: window.detail,
      effect: {
        type: 'recency',
        id: window.id,
        minDate: window.minDate,
        maxDate: window.maxDate,
        label: window.detail,
        historyLabel: window.id === 'any'
          ? "Doesn't matter (no date)"
          : `${window.label} (${window.detail})`
      }
    }))
  }
}

export function dateSplitEncounter(minDate, maxDate) {
  return {
    kind: 'datesplit',
    prompt: 'Which part of that period?',
    detail: 'This replaces the wider range. The search keeps one date clause.',
    options: splitWindow(minDate, maxDate).map((range, index) => ({
      id: `split-${index + 1}`,
      label: `${formatDay(range.minDate)} – ${formatDay(range.maxDate)}`,
      detail: 'Replaces the wider release window',
      effect: {
        type: 'datesplit',
        minDate: range.minDate,
        maxDate: range.maxDate
      }
    }))
  }
}

export function scoreEncounter() {
  const options = SCORE_LADDER.map((label) => {
    const included = scoresAtLeast(label)
    return {
      id: label,
      label,
      detail: included.join(', '),
      effect: { type: 'score', id: label }
    }
  })
  options.push({
    id: 'any',
    label: "Doesn't matter",
    detail: 'No review-score clause',
    effect: { type: 'score', id: 'any' }
  })
  return {
    kind: 'score',
    prompt: 'Review score is at least…',
    detail: 'Least strict to most strict. The chosen label includes every stricter one.',
    options
  }
}

export function reviewsEncounter() {
  return {
    kind: 'reviews',
    prompt: 'How many reviews?',
    detail: 'Positive reviews plus negative reviews.',
    options: [
      {
        id: 'gt-10000',
        label: 'Greater than 10,000',
        detail: 'More than 10,000 combined reviews',
        effect: {
          type: 'reviews',
          minReviews: 10001,
          maxReviews: 10000000,
          label: 'Greater than 10,000',
          constraintName: 'greater than 10,000 reviews'
        }
      },
      {
        id: '1k-10k',
        label: '1,000 through 10,000',
        detail: '1,000 through 10,000, inclusive',
        effect: {
          type: 'reviews',
          minReviews: 1000,
          maxReviews: 10000,
          label: '1,000 through 10,000',
          constraintName: '1,000 through 10,000 reviews'
        }
      },
      {
        id: 'under-1000',
        label: 'Under 1,000',
        detail: 'Fewer than 1,000 combined reviews',
        effect: {
          type: 'reviews',
          minReviews: 0,
          maxReviews: 999,
          label: 'Under 1,000',
          constraintName: 'under 1,000 reviews'
        }
      }
    ]
  }
}

export function applyEffect(picks, effect) {
  if (effect.type === 'tag') {
    picks.tags.push(effect.tag)
    picks.history.push(effect.tag)
    return
  }
  if (effect.type === 'recency') {
    if (effect.id === 'any') {
      picks.skipDateSplit = true
      picks.minDate = ''
      picks.maxDate = ''
      picks.dateLabel = ''
      picks.coarseMin = ''
      picks.coarseMax = ''
      picks.history.push("Doesn't matter (no date)")
      return
    }
    picks.skipDateSplit = false
    picks.minDate = effect.minDate
    picks.maxDate = effect.maxDate
    picks.dateLabel = effect.label
    picks.coarseMin = effect.minDate
    picks.coarseMax = effect.maxDate
    picks.history.push(effect.historyLabel)
    return
  }
  if (effect.type === 'datesplit') {
    picks.minDate = effect.minDate
    picks.maxDate = effect.maxDate
    picks.dateLabel = `${formatDay(effect.minDate)} – ${formatDay(effect.maxDate)}`
    picks.history.push(picks.dateLabel)
    return
  }
  if (effect.type === 'score') {
    if (effect.id === 'any') {
      picks.reviewScores = null
      picks.scoreLabel = ''
      picks.history.push("Doesn't matter (any review score)")
      return
    }
    picks.reviewScores = scoresAtLeast(effect.id)
    picks.scoreLabel = effect.id
    picks.history.push(`At least ${effect.id}`)
    return
  }
  if (effect.type === 'reviews') {
    picks.minReviews = effect.minReviews
    picks.maxReviews = effect.maxReviews
    picks.reviewCountLabel = effect.constraintName
    picks.history.push(effect.label)
  }
}

function clonePicks(picks) {
  return {
    ...picks,
    tags: [...picks.tags],
    reviewScores: picks.reviewScores ? [...picks.reviewScores] : null,
    history: [...picks.history]
  }
}

export function constraintsOf(picks) {
  const constraints = picks.tags.map((tag) => ({
    name: `tag "${tag}"`,
    apply(query) {
      query.tags.push(tag)
    }
  }))
  if (picks.minDate && picks.maxDate) {
    const minDate = picks.minDate
    const maxDate = picks.maxDate
    constraints.push({
      name: `release date ${minDate} through ${maxDate}`,
      apply(query) {
        query.minDate = minDate
        query.maxDate = maxDate
      }
    })
  }
  if (picks.reviewScores?.length) {
    const reviewScores = [...picks.reviewScores]
    const scoreLabel = picks.scoreLabel
    constraints.push({
      name: `review score at least ${scoreLabel}`,
      apply(query) {
        query.reviewScores = reviewScores
        query.scoreLabel = scoreLabel
      }
    })
  }
  if (picks.reviewCountLabel) {
    const { minReviews, maxReviews, reviewCountLabel } = picks
    constraints.push({
      name: reviewCountLabel,
      apply(query) {
        query.minReviews = minReviews
        query.maxReviews = maxReviews
        query.reviewCountLabel = reviewCountLabel
      }
    })
  }
  return constraints
}

export function queryFromConstraints(constraints) {
  const query = freshPicks()
  for (const constraint of constraints) constraint.apply(query)
  return query
}

export function relaxationQueries(picks) {
  const constraints = constraintsOf(picks)
  return constraints.map((constraint, index) => ({
    name: constraint.name,
    picks: queryFromConstraints(constraints.filter((_, other) => other !== index))
  }))
}
