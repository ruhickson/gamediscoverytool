const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function todayYmd(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function parseYmd(ymd) {
  const [year, month, day] = ymd.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function formatYmd(ms) {
  const date = new Date(ms)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDay(ymd) {
  const [year, month, day] = ymd.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]} ${year}`
}

export function addDays(ymd, days) {
  return formatYmd(parseYmd(ymd) + days * 86400000)
}

export function inclusiveDayCount(startYmd, endYmd) {
  return Math.round((parseYmd(endYmd) - parseYmd(startYmd)) / 86400000) + 1
}

/**
 * Split a closed date window into three contiguous ranges.
 * Lengths differ by at most one day. Earlier ranges receive the extra days.
 */
export function splitWindow(startYmd, endYmd) {
  const total = inclusiveDayCount(startYmd, endYmd)
  if (total < 3) {
    throw new Error(`Date window ${startYmd} through ${endYmd} is too short to split into three ranges`)
  }
  const base = Math.floor(total / 3)
  const remainder = total % 3
  const lengths = [0, 1, 2].map((index) => base + (remainder > index ? 1 : 0))
  const ranges = []
  let cursor = startYmd
  for (const length of lengths) {
    const maxDate = addDays(cursor, length - 1)
    ranges.push({ minDate: cursor, maxDate, days: length })
    cursor = addDays(maxDate, 1)
  }
  return ranges
}
