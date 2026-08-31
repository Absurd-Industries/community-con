import { describe, it, expect } from 'vitest'
import { isAdminEmail } from './admin-email.js'

describe('isAdminEmail', () => {
  it('matches a single configured admin email', () => {
    expect(isAdminEmail('alice@example.com', 'alice@example.com')).toBe(true)
  })

  it('matches one of multiple comma-separated admin emails', () => {
    expect(isAdminEmail('bob@example.com', 'alice@example.com,bob@example.com')).toBe(true)
  })

  it('matches one of multiple newline-separated admin emails', () => {
    expect(isAdminEmail('bob@example.com', 'alice@example.com\nbob@example.com')).toBe(true)
  })

  it('ignores whitespace and case', () => {
    expect(isAdminEmail(' Bob@Example.com ', ' alice@example.com, bob@example.com ')).toBe(true)
  })

  it('does not match unconfigured emails', () => {
    expect(isAdminEmail('carol@example.com', 'alice@example.com,bob@example.com')).toBe(false)
  })

  it('does not match when no admin emails are configured', () => {
    expect(isAdminEmail('alice@example.com', undefined)).toBe(false)
  })
})
