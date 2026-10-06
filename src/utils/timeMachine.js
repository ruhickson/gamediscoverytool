/** Steam storefront launch month */
export const STEAM_LAUNCH = { year: 2003, monthIndex: 8 } // September 2003

export function toYmd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  })
}

export function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0)
}

/**
 * Time Machine options: "This month" plus every calendar month back to Sep 2003.
 */
export function getTimeMachineOptions() {
  const now = new Date()
  const options = [{ value: 'this-month', label: 'This month' }]

  let year = now.getFullYear()
  let monthIndex = now.getMonth()

  while (
    year > STEAM_LAUNCH.year ||
    (year === STEAM_LAUNCH.year && monthIndex >= STEAM_LAUNCH.monthIndex)
  ) {
    const value = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    options.push({
      value,
      label: monthLabel(year, monthIndex)
    })
    monthIndex -= 1
    if (monthIndex < 0) {
      monthIndex = 11
      year -= 1
    }
  }

  return options
}

/**
 * Resolve a Time Machine selection into concrete date ranges for Cube queries.
 * @param {string} monthKey 'this-month' or 'YYYY-MM'
 */
export function resolveTimeMachinePeriod(monthKey = 'this-month') {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let year
  let monthIndex
  let isCurrent = false

  if (!monthKey || monthKey === 'this-month') {
    year = today.getFullYear()
    monthIndex = today.getMonth()
    isCurrent = true
  } else {
    const [y, m] = monthKey.split('-').map(Number)
    year = y
    monthIndex = m - 1
    isCurrent =
      year === today.getFullYear() && monthIndex === today.getMonth()
  }

  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = lastDayOfMonth(year, monthIndex)
  const rangeEnd = isCurrent && monthEnd > today ? today : monthEnd

  const prevMonthEnd = new Date(year, monthIndex, 0)
  const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1)

  const yearStart = new Date(year, 0, 1)
  const yearEnd = isCurrent ? today : new Date(year, 11, 31)
  // For a historical month mid-year, "this year" = full that calendar year
  const selectedYearEnd = isCurrent ? today : new Date(year, 11, 31)

  const prevYear = year - 1
  const prevYearStart = new Date(prevYear, 0, 1)
  const prevYearEnd = new Date(prevYear, 11, 31)

  const steamLaunch = new Date(STEAM_LAUNCH.year, STEAM_LAUNCH.monthIndex, 1)

  return {
    key: isCurrent && monthKey === 'this-month' ? 'this-month' : `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    label: isCurrent && (!monthKey || monthKey === 'this-month')
      ? 'This month'
      : monthLabel(year, monthIndex),
    isCurrent,
    year,
    monthIndex,
    // Primary filter window (selected month, capped at today when current)
    range: [toYmd(monthStart), toYmd(rangeEnd)],
    fullMonthRange: [toYmd(monthStart), toYmd(monthEnd)],
    monthStart,
    monthEnd: rangeEnd,
    prevMonthRange: [toYmd(prevMonthStart), toYmd(prevMonthEnd)],
    prevMonthLabel: monthLabel(prevMonthStart.getFullYear(), prevMonthStart.getMonth()),
    yearRange: [toYmd(yearStart), toYmd(selectedYearEnd)],
    yearLabel: String(year),
    prevYearRange: [toYmd(prevYearStart), toYmd(prevYearEnd)],
    prevYearLabel: String(prevYear),
    toDateRange: [toYmd(steamLaunch), toYmd(rangeEnd)],
    today: toYmd(today)
  }
}
