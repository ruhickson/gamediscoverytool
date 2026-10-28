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
    minReviews: 11,
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

export function tagEncounter(group, index, total = group.length) {
  return {
    kind: 'tags',
    prompt: `Which tag should this include? (${index + 1} of ${total})`,
    detail: '',
    options: group.map((tag) => ({
      id: tag.name,
      label: tag.name,
      detail: `${Number(tag.count).toLocaleString('en-US')} games`,
      effect: { type: 'tag', tag: tag.name }
    }))
  }
}

export function recencyEncounter(today = todayYmd()) {
  const currentYear = Number(String(today).slice(0, 4))
  const windows = [2023, 2024, 2025, 2026].map((year) => {
    const minDate = `${year}-01-01`
    const maxDate = year === currentYear ? today : `${year}-12-31`
    return {
      id: String(year),
      label: String(year),
      minDate,
      maxDate,
      detail: `${formatDay(minDate)} – ${formatDay(maxDate)}`
    }
  })
  return {
    kind: 'recency',
    prompt: 'When did it come out?',
    detail: '',
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
  const options = splitWindow(minDate, maxDate).map((range, index) => ({
    id: `split-${index + 1}`,
    label: `${formatDay(range.minDate)} – ${formatDay(range.maxDate)}`,
    detail: '',
    effect: {
      type: 'datesplit',
      minDate: range.minDate,
      maxDate: range.maxDate
    }
  }))
  options.push({
    id: 'any',
    label: "Doesn't matter",
    detail: '',
    effect: { type: 'datesplit', id: 'any' }
  })
  return {
    kind: 'datesplit',
    prompt: 'Which part of that period?',
    detail: '',
    options
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

export function reviewsEncounter(scoreLabel = '') {
  const options = [
    {
      id: 'under-1000',
      label: '<1000',
      detail: 'Fewer than 1,000 combined reviews',
      effect: {
        type: 'reviews',
        minReviews: 0,
        maxReviews: 999,
        label: '<1000',
        constraintName: 'under 1,000 reviews'
      }
    },
    {
      id: 'any',
      label: "Doesn't matter",
      detail: 'At least 11 reviews',
      effect: { type: 'reviews', id: 'any', minReviews: 11, maxReviews: 10000000 }
    },
    {
      id: 'over-1000',
      label: '>1000',
      detail: 'More than 1,000 combined reviews',
      effect: {
        type: 'reviews',
        minReviews: 1001,
        maxReviews: 10000000,
        label: '>1000',
        constraintName: 'over 1,000 reviews'
      }
    }
  ]
  const visible = scoreLabel === 'Overwhelmingly Positive'
    ? options.filter((option) => option.id !== 'any')
    : options
  return {
    kind: 'reviews',
    prompt: 'How many reviews?',
    detail: 'Positive reviews plus negative reviews.',
    options: visible
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
    if (effect.id === 'any') {
      picks.history.push("Doesn't matter (keep the wider dates)")
      return
    }
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
    if (effect.id === 'any') {
      picks.minReviews = effect.minReviews ?? 11
      picks.maxReviews = effect.maxReviews ?? 10000000
      picks.reviewCountLabel = ''
      picks.history.push("Doesn't matter (at least 11 reviews)")
      return
    }
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
