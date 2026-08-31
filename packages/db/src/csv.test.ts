import { describe, it, expect } from 'vitest'
import { parseAndValidateCsv } from './csv.js'

describe('parseAndValidateCsv', () => {
  it('parses valid CSV', () => {
    const csv = `title,description,duration_minutes,presenter_name,presenter_bio,presenter_email
My Talk,A cool talk,30,Jane Doe,Bio here,jane@example.com`
    const { rows, errors } = parseAndValidateCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe('My Talk')
    expect(rows[0].duration_minutes).toBe(30)
  })

  it('returns error for missing required title', () => {
    const csv = `title,description,duration_minutes,presenter_name
,A talk,30,Jane`
    const { errors } = parseAndValidateCsv(csv)
    expect(errors.some(e => e.row === 1 && e.field === 'title')).toBe(true)
  })

  it('returns error for non-integer duration', () => {
    const csv = `title,description,duration_minutes,presenter_name
My Talk,desc,abc,Jane`
    const { errors } = parseAndValidateCsv(csv)
    expect(errors.some(e => e.field === 'duration_minutes')).toBe(true)
  })

  it('returns error for missing presenter_name', () => {
    const csv = `title,description,duration_minutes,presenter_name
My Talk,desc,30,`
    const { errors } = parseAndValidateCsv(csv)
    expect(errors.some(e => e.field === 'presenter_name')).toBe(true)
  })

  it('accepts optional fields and duration as empty', () => {
    const csv = `title,presenter_name
My Talk,Jane`
    const { rows, errors } = parseAndValidateCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows[0].duration_minutes).toBe(0)
    expect(rows[0].description).toBeNull()
    expect(rows[0].presenter_bio).toBeNull()
    expect(rows[0].presenter_email).toBeNull()
  })

  it('collects errors from multiple rows without short-circuiting', () => {
    const csv = `title,duration_minutes,presenter_name
,30,Jane
My Talk,abc,Jane`
    const { errors } = parseAndValidateCsv(csv)
    expect(errors).toHaveLength(2)
  })

  it('parses quoted commas and escaped quotes', () => {
    const csv = `title,description,duration_minutes,presenter_name
"Scaling, Carefully","A ""practical"" guide",30,Jane`
    const { rows, errors } = parseAndValidateCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows[0].title).toBe('Scaling, Carefully')
    expect(rows[0].description).toBe('A "practical" guide')
  })

  it('parses multiline quoted fields', () => {
    const csv = `title,description,duration_minutes,presenter_name
My Talk,"Line one
Line two",30,Jane`
    const { rows, errors } = parseAndValidateCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows[0].description).toBe('Line one\nLine two')
  })

  it('preserves quoted optional field content', () => {
    const csv = `title,description,duration_minutes,presenter_name
My Talk,"  keep surrounding spaces  ",30,Jane`
    const { rows, errors } = parseAndValidateCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows[0].description).toBe('  keep surrounding spaces  ')
  })
})
