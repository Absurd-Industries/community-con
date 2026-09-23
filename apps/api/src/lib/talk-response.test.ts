import { describe, expect, it } from 'vitest'
import { serializePublicTalk } from './talk-response.js'
import type { Talk } from '@cc/db'

const talk: Talk & { vote_count: number } = {
  id: 'talk-1',
  conference_id: 'conf-1',
  title: 'A private proposal',
  description: 'Public abstract',
  duration_minutes: 30,
  presenter_name: 'Ada',
  presenter_bio: 'Public biography',
  presenter_email: 'ada@example.com',
  talk_type: 'hardware',
  cfp_url: 'https://fossunited.example/proposal/1',
  cfp_content: 'Internal reviewer material',
  references: 'https://example.com/public',
  withdrawn_at: null,
  withdrawal_reason: null,
  created_at: 1,
  vote_count: 7,
}

describe('serializePublicTalk', () => {
  it('hides all speaker identity in hidden mode', () => {
    const result = serializePublicTalk(talk, 'hidden')
    expect(result).not.toHaveProperty('presenter_name')
    expect(result).not.toHaveProperty('presenter_bio')
  })

  it('shows only the speaker name in basic mode', () => {
    const result = serializePublicTalk(talk, 'basic')
    expect(result.presenter_name).toBe('Ada')
    expect(result).not.toHaveProperty('presenter_bio')
  })

  it('shows approved speaker details in full mode', () => {
    const result = serializePublicTalk(talk, 'full')
    expect(result.presenter_name).toBe('Ada')
    expect(result.presenter_bio).toBe('Public biography')
    expect(result.cfp_url).toBe('https://fossunited.example/proposal/1')
  })

  it.each(['hidden', 'basic'] as const)('hides the speaker link in %s mode', (visibility) => {
    expect(serializePublicTalk(talk, visibility)).not.toHaveProperty('cfp_url')
  })

  it.each(['hidden', 'basic', 'full'] as const)('never exposes private fields in %s mode', (visibility) => {
    const result = serializePublicTalk(talk, visibility)
    expect(result).not.toHaveProperty('presenter_email')
    expect(result).not.toHaveProperty('cfp_content')
    expect(result).not.toHaveProperty('conference_id')
  })

  it('includes result fields only when present', () => {
    expect(serializePublicTalk(talk, 'basic')).toMatchObject({ vote_count: 7 })
  })
})
