export interface CsvTalkRow {
  title: string
  description: string | null
  duration_minutes: number
  presenter_name: string
  presenter_bio: string | null
  presenter_email: string | null
  talk_type: string | null
  cfp_url: string | null
  cfp_content: string | null
  references: string | null
}

// Header aliases so the raw FOSS United submissions export imports directly.
const HEADER_ALIASES: Record<string, string> = {
  session_title: 'title',
  speaker: 'presenter_name',
  track: 'talk_type',
  link: 'cfp_url',
}

export interface CsvError {
  row: number
  field: string
  message: string
}

export function parseAndValidateCsv(csv: string): {
  rows: CsvTalkRow[]
  errors: CsvError[]
} {
  const records = parseCsvRecords(csv)
  if (records.length < 2) return { rows: [], errors: [] }

  const headers = records[0].map(h => {
    const key = h.trim().toLowerCase()
    return HEADER_ALIASES[key] ?? key
  })

  const rows: CsvTalkRow[] = []
  const errors: CsvError[] = []

  for (let i = 1; i < records.length; i++) {
    const values = records[i]
    if (values.every(value => value.trim() === '')) continue

    const getRaw = (col: string) => {
      const idx = headers.indexOf(col)
      return idx >= 0 ? (values[idx] ?? '') : ''
    }
    const getTrimmed = (col: string) => getRaw(col).trim()
    const getOptional = (col: string) => {
      const value = getRaw(col)
      return value.trim() === '' ? null : value
    }

    const rowErrors: CsvError[] = []

    const title = getTrimmed('title')
    if (!title) rowErrors.push({ row: i, field: 'title', message: 'title is required' })

    const presenterName = getTrimmed('presenter_name')
    if (!presenterName) rowErrors.push({ row: i, field: 'presenter_name', message: 'presenter_name is required' })

    const durationRaw = getTrimmed('duration_minutes')
    const duration = durationRaw ? parseInt(durationRaw, 10) : 0
    if (durationRaw && (isNaN(duration) || duration < 0 || String(duration) !== durationRaw)) {
      rowErrors.push({ row: i, field: 'duration_minutes', message: 'duration_minutes must be a non-negative integer' })
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      continue
    }

    rows.push({
      title,
      description: getOptional('description'),
      duration_minutes: duration,
      presenter_name: presenterName,
      presenter_bio: getOptional('presenter_bio'),
      presenter_email: getOptional('presenter_email'),
      talk_type: getOptional('talk_type'),
      cfp_url: getOptional('cfp_url'),
      cfp_content: getOptional('cfp_content'),
      references: getOptional('references'),
    })
  }

  return { rows, errors }
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let current = ''
  let inQuotes = false

  const input = csv.startsWith('\uFEFF') ? csv.slice(1) : csv

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      record.push(current)
      current = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      record.push(current)
      records.push(record)
      record = []
      current = ''
      if (ch === '\r' && input[i + 1] === '\n') i++
    } else {
      current += ch
    }
  }

  record.push(current)
  if (record.length > 1 || record[0] !== '' || records.length === 0) {
    records.push(record)
  }

  return records
}

/**
 * The columns an export writes, and the ones the importer above reads back.
 *
 * Deliberately the same list, in this file, so the two cannot drift apart: an
 * export that will not re-import is a trap for anyone editing proposals in a
 * spreadsheet and loading them back.
 */
export const CSV_COLUMNS = [
  'title',
  'description',
  'duration_minutes',
  'presenter_name',
  'presenter_bio',
  'presenter_email',
  'talk_type',
  'cfp_url',
  'cfp_content',
  'references',
] as const

/**
 * Quote a single cell.
 *
 * Anything with a comma, a quote, a newline or edge whitespace has to be
 * quoted, or the row silently gains a column when it is read back. Leading and
 * trailing spaces matter too: Excel eats them otherwise.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text === '') return ''
  if (/[",\r\n]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

type ExportableTalk = Partial<Record<(typeof CSV_COLUMNS)[number], string | number | null>> & {
  id?: string
}

/**
 * Serialise talks to CSV that `parseAndValidateCsv` reads back unchanged.
 *
 * `withId` prepends the talk's internal id. That id is what appears in the
 * ballot log's talk_ids, so anyone counting the votes themselves needs this
 * column to turn "demo_1" into a title. The importer ignores the column, so an
 * exported file still re-imports; the new talks simply get fresh ids.
 */
export function talksToCsv(talks: ExportableTalk[], { withId = false } = {}): string {
  const columns = withId ? ['id', ...CSV_COLUMNS] : [...CSV_COLUMNS]
  const lines = [columns.join(',')]
  for (const talk of talks) {
    lines.push(columns.map(column => csvCell((talk as Record<string, never>)[column])).join(','))
  }
  // Trailing newline: some spreadsheet importers drop the last row without it.
  return lines.join('\n') + '\n'
}
